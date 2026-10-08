import {
  formatIssueKey,
  parseIssueKey,
  type ActivityType,
  type CommentDto,
  type IssueCreateInput,
  type IssueDetail,
  type IssueFilters,
  type IssueListItem,
  type IssueStatus,
  type IssueUpdateInput,
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

async function userName(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
  return row?.name ?? null;
}

async function projectName(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, id));
  return row?.name ?? null;
}

async function cycleName(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ number: cycles.number }).from(cycles).where(eq(cycles.id, id));
  return row ? `Cycle ${row.number}` : null;
}

async function issueKeyOf(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db
    .select({ key: teams.key, number: issues.number })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .where(eq(issues.id, id));
  return row ? formatIssueKey(row.key, row.number) : null;
}

interface PendingActivity {
  type: ActivityType;
  payload: Record<string, unknown>;
}

export async function updateIssue(
  db: DbOrTx,
  id: string,
  patch: IssueUpdateInput,
  actorId: string,
): Promise<IssueDetail> {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(issues).where(eq(issues.id, id)).for('update');
    if (!cur) throw notFound('Issue');
    await validateRefs(tx, cur.teamId, patch, id);

    const set: Partial<typeof issues.$inferInsert> = {};
    const events: PendingActivity[] = [];

    if (patch.title !== undefined && patch.title !== cur.title) {
      set.title = patch.title;
      events.push({ type: 'title', payload: { from: cur.title, to: patch.title } });
    }
    if (patch.description !== undefined && patch.description !== cur.description) {
      set.description = patch.description;
    }
    if (patch.status !== undefined && patch.status !== cur.status) {
      set.status = patch.status;
      events.push({ type: 'status', payload: { from: cur.status, to: patch.status } });
    }
    if (patch.priority !== undefined && patch.priority !== cur.priority) {
      set.priority = patch.priority;
      events.push({ type: 'priority', payload: { from: cur.priority, to: patch.priority } });
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== cur.assigneeId) {
      set.assigneeId = patch.assigneeId;
      events.push({
        type: 'assignee',
        payload: { from: await userName(tx, cur.assigneeId), to: await userName(tx, patch.assigneeId) },
      });
    }
    if (patch.projectId !== undefined && patch.projectId !== cur.projectId) {
      set.projectId = patch.projectId;
      events.push({
        type: 'project',
        payload: { from: await projectName(tx, cur.projectId), to: await projectName(tx, patch.projectId) },
      });
    }
    if (patch.cycleId !== undefined && patch.cycleId !== cur.cycleId) {
      set.cycleId = patch.cycleId;
      events.push({
        type: 'cycle',
        payload: { from: await cycleName(tx, cur.cycleId), to: await cycleName(tx, patch.cycleId) },
      });
    }
    if (patch.parentId !== undefined && patch.parentId !== cur.parentId) {
      set.parentId = patch.parentId;
      events.push({
        type: 'parent',
        payload: { from: await issueKeyOf(tx, cur.parentId), to: await issueKeyOf(tx, patch.parentId) },
      });
    }
    if (patch.dueDate !== undefined && patch.dueDate !== cur.dueDate) {
      set.dueDate = patch.dueDate;
      events.push({ type: 'due_date', payload: { from: cur.dueDate, to: patch.dueDate } });
    }
    if (patch.estimate !== undefined && patch.estimate !== cur.estimate) {
      set.estimate = patch.estimate;
      events.push({ type: 'estimate', payload: { from: cur.estimate, to: patch.estimate } });
    }
    if (patch.sortOrder !== undefined) {
      set.sortOrder = patch.sortOrder;
    } else if (set.status) {
      set.sortOrder = await nextSortOrder(tx, cur.teamId, set.status);
    }

    let labelsChanged = false;
    if (patch.labelIds !== undefined) {
      const current = await tx
        .select({ id: labels.id, name: labels.name })
        .from(issueLabels)
        .innerJoin(labels, eq(labels.id, issueLabels.labelId))
        .where(eq(issueLabels.issueId, id));
      const next = new Set(patch.labelIds);
      const currentIds = new Set(current.map((l) => l.id));
      const removed = current.filter((l) => !next.has(l.id));
      const addedIds = [...next].filter((labelId) => !currentIds.has(labelId));
      if (removed.length) {
        await tx.delete(issueLabels).where(
          and(
            eq(issueLabels.issueId, id),
            inArray(
              issueLabels.labelId,
              removed.map((l) => l.id),
            ),
          ),
        );
      }
      if (addedIds.length) {
        await tx.insert(issueLabels).values(addedIds.map((labelId) => ({ issueId: id, labelId })));
      }
      if (removed.length || addedIds.length) {
        const added = addedIds.length
          ? await tx.select({ name: labels.name }).from(labels).where(inArray(labels.id, addedIds)).orderBy(asc(labels.name))
          : [];
        events.push({
          type: 'labels',
          payload: { added: added.map((l) => l.name), removed: removed.map((l) => l.name) },
        });
        labelsChanged = true;
      }
    }

    if (Object.keys(set).length || labelsChanged) {
      set.updatedAt = new Date();
      await tx.update(issues).set(set).where(eq(issues.id, id));
    }
    if (events.length) {
      await tx.insert(activity).values(events.map((e) => ({ issueId: id, actorId, ...e })));
    }
  });
  return getIssueById(db, id);
}

export async function deleteIssue(db: DbOrTx, id: string): Promise<void> {
  const deleted = await db.delete(issues).where(eq(issues.id, id)).returning({ id: issues.id });
  if (deleted.length === 0) throw notFound('Issue');
}

export async function addComment(db: DbOrTx, issueId: string, body: string, authorId: string): Promise<CommentDto> {
  return db.transaction(async (tx) => {
    const [issue] = await tx.select({ id: issues.id }).from(issues).where(eq(issues.id, issueId));
    if (!issue) throw notFound('Issue');
    const [row] = await tx.insert(comments).values({ issueId, authorId, body }).returning();
    await tx.insert(activity).values({ issueId, actorId: authorId, type: 'comment', payload: { commentId: row.id } });
    const [author] = await tx.select(userColumns).from(users).where(eq(users.id, authorId));
    return { id: row.id, issueId, body: row.body, createdAt: row.createdAt.toISOString(), author };
  });
}
