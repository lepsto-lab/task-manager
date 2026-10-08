import {
  formatIssueKey,
  parseIssueKey,
  type IssueCreateInput,
  type IssueDetail,
  type IssueFilters,
  type IssueListItem,
  type IssueStatus,
  type Label,
} from '@tm/shared';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { userColumns } from '../db/columns';
import { activity, comments, cycles, issueLabels, issues, labels, projects, teams, users } from '../db/schema';
import { HttpError, badRequest, notFound } from '../errors';
import { validateRefs } from './refs';

const listColumns = {
  id: issues.id,
  teamId: issues.teamId,
  teamKey: teams.key,
  number: issues.number,
  title: issues.title,
  status: issues.status,
  priority: issues.priority,
  projectId: issues.projectId,
  cycleId: issues.cycleId,
  parentId: issues.parentId,
  dueDate: issues.dueDate,
  estimate: issues.estimate,
  sortOrder: issues.sortOrder,
  createdAt: issues.createdAt,
  updatedAt: issues.updatedAt,
  assignee: userColumns,
};

export async function loadLabels(db: DbOrTx, issueIds: string[]): Promise<Map<string, Label[]>> {
  const map = new Map<string, Label[]>();
  if (issueIds.length === 0) return map;
  const rows = await db
    .select({ issueId: issueLabels.issueId, id: labels.id, teamId: labels.teamId, name: labels.name, color: labels.color })
    .from(issueLabels)
    .innerJoin(labels, eq(labels.id, issueLabels.labelId))
    .where(inArray(issueLabels.issueId, issueIds))
    .orderBy(asc(labels.name));
  for (const { issueId, ...label } of rows) {
    const list = map.get(issueId) ?? [];
    list.push(label);
    map.set(issueId, list);
  }
  return map;
}

async function queryListItems(db: DbOrTx, where: SQL | undefined): Promise<IssueListItem[]> {
  const rows = await db
    .select(listColumns)
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .leftJoin(users, eq(users.id, issues.assigneeId))
    .where(where)
    .orderBy(asc(issues.sortOrder), desc(issues.createdAt));
  const labelMap = await loadLabels(
    db,
    rows.map((r) => r.id),
  );
  return rows.map(({ teamKey, createdAt, updatedAt, ...row }) => ({
    ...row,
    key: formatIssueKey(teamKey, row.number),
    labels: labelMap.get(row.id) ?? [],
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));
}

export async function listIssues(
  db: DbOrTx,
  filters: IssueFilters,
  userId: string | null,
): Promise<IssueListItem[]> {
  const conds: SQL[] = [];
  if (filters.teamId) conds.push(eq(issues.teamId, filters.teamId));
  if (filters.status?.length) conds.push(inArray(issues.status, filters.status));
  if (filters.priority?.length) conds.push(inArray(issues.priority, filters.priority));
  if (filters.assigneeId?.length) conds.push(inArray(issues.assigneeId, filters.assigneeId));
  if (filters.projectId) conds.push(eq(issues.projectId, filters.projectId));
  if (filters.cycleId) conds.push(eq(issues.cycleId, filters.cycleId));
  if (filters.parentId) conds.push(eq(issues.parentId, filters.parentId));
  if (filters.labelId?.length) {
    conds.push(
      inArray(
        issues.id,
        db.select({ id: issueLabels.issueId }).from(issueLabels).where(inArray(issueLabels.labelId, filters.labelId)),
      ),
    );
  }
  if (filters.mine) {
    if (!userId) throw new HttpError(400, 'user_required', 'X-User-Id header is required');
    conds.push(eq(issues.assigneeId, userId));
  }
  return queryListItems(db, conds.length ? and(...conds) : undefined);
}

async function getIssueDetail(db: DbOrTx, where: SQL): Promise<IssueDetail> {
  const [item] = await queryListItems(db, where);
  if (!item) throw notFound('Issue');

  const [extra] = await db
    .select({ description: issues.description, creator: userColumns })
    .from(issues)
    .innerJoin(users, eq(users.id, issues.creatorId))
    .where(eq(issues.id, item.id));
  const [project] = item.projectId
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, item.projectId))
    : [null];
  const [cycle] = item.cycleId
    ? await db
        .select({ id: cycles.id, number: cycles.number, startsOn: cycles.startsOn, endsOn: cycles.endsOn })
        .from(cycles)
        .where(eq(cycles.id, item.cycleId))
    : [null];
  const [parent] = item.parentId ? await queryListItems(db, eq(issues.id, item.parentId)) : [undefined];
  const children = await queryListItems(db, eq(issues.parentId, item.id));
  const commentRows = await db
    .select({
      id: comments.id,
      issueId: comments.issueId,
      body: comments.body,
      createdAt: comments.createdAt,
      author: userColumns,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.issueId, item.id))
    .orderBy(asc(comments.createdAt));
  const activityRows = await db
    .select({
      id: activity.id,
      issueId: activity.issueId,
      type: activity.type,
      payload: activity.payload,
      createdAt: activity.createdAt,
      actor: userColumns,
    })
    .from(activity)
    .innerJoin(users, eq(users.id, activity.actorId))
    .where(eq(activity.issueId, item.id))
    .orderBy(asc(activity.createdAt));

  return {
    ...item,
    description: extra.description,
    creator: extra.creator,
    project: project ?? null,
    cycle: cycle ?? null,
    parent: parent ? { id: parent.id, key: parent.key, title: parent.title, status: parent.status } : null,
    children,
    comments: commentRows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    activity: activityRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

export async function getIssueByKey(db: DbOrTx, key: string): Promise<IssueDetail> {
  const parsed = parseIssueKey(key);
  if (!parsed) throw notFound('Issue');
  return getIssueDetail(db, and(eq(teams.key, parsed.teamKey), eq(issues.number, parsed.number))!);
}

export async function getIssueById(db: DbOrTx, id: string): Promise<IssueDetail> {
  return getIssueDetail(db, eq(issues.id, id));
}

export async function nextSortOrder(db: DbOrTx, teamId: string, status: IssueStatus): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${issues.sortOrder})` })
    .from(issues)
    .where(and(eq(issues.teamId, teamId), eq(issues.status, status)));
  return (row?.max ?? 0) + 1000;
}

export async function createIssue(db: DbOrTx, input: IssueCreateInput, actorId: string): Promise<IssueDetail> {
  const id = await db.transaction(async (tx) => {
    const [team] = await tx
      .update(teams)
      .set({ issueCounter: sql`${teams.issueCounter} + 1` })
      .where(eq(teams.id, input.teamId))
      .returning({ counter: teams.issueCounter });
    if (!team) throw badRequest('Unknown team');
    await validateRefs(tx, input.teamId, input, null);

    const status = input.status ?? 'todo';
    const [row] = await tx
      .insert(issues)
      .values({
        teamId: input.teamId,
        number: team.counter,
        title: input.title,
        description: input.description ?? '',
        status,
        priority: input.priority ?? 'none',
        assigneeId: input.assigneeId ?? null,
        creatorId: actorId,
        projectId: input.projectId ?? null,
        cycleId: input.cycleId ?? null,
        parentId: input.parentId ?? null,
        dueDate: input.dueDate ?? null,
        estimate: input.estimate ?? null,
        sortOrder: await nextSortOrder(tx, input.teamId, status),
      })
      .returning({ id: issues.id });

    const labelIds = [...new Set(input.labelIds ?? [])];
    if (labelIds.length) {
      await tx.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId: row.id, labelId })));
    }
    await tx.insert(activity).values({ issueId: row.id, actorId, type: 'created', payload: {} });
    return row.id;
  });
  return getIssueById(db, id);
}
