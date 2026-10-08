import { formatIssueKey, type InboxReadInput, type InboxResponse } from '@tm/shared';
import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { userColumns } from '../db/columns';
import { activity, inboxReads, issues, teams, users } from '../db/schema';

function visibleTo(userId: string): SQL {
  return and(or(eq(issues.assigneeId, userId), eq(issues.creatorId, userId)), ne(activity.actorId, userId))!;
}

export async function getInbox(db: DbOrTx, userId: string): Promise<InboxResponse> {
  const readJoin = and(eq(inboxReads.activityId, activity.id), eq(inboxReads.userId, userId));
  const rows = await db
    .select({
      id: activity.id,
      issueId: activity.issueId,
      type: activity.type,
      payload: activity.payload,
      createdAt: activity.createdAt,
      actor: userColumns,
      teamKey: teams.key,
      number: issues.number,
      title: issues.title,
      status: issues.status,
      readId: inboxReads.activityId,
    })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .innerJoin(users, eq(users.id, activity.actorId))
    .leftJoin(inboxReads, readJoin)
    .where(visibleTo(userId))
    .orderBy(desc(activity.createdAt))
    .limit(200);
  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .leftJoin(inboxReads, readJoin)
    .where(and(visibleTo(userId), isNull(inboxReads.activityId)));

  return {
    unreadCount: unread?.count ?? 0,
    items: rows.map((r) => ({
      read: r.readId !== null,
      activity: {
        id: r.id,
        issueId: r.issueId,
        type: r.type,
        payload: r.payload,
        createdAt: r.createdAt.toISOString(),
        actor: r.actor,
      },
      issue: { id: r.issueId, key: formatIssueKey(r.teamKey, r.number), title: r.title, status: r.status },
    })),
  };
}

export async function markInboxRead(db: DbOrTx, userId: string, input: InboxReadInput): Promise<void> {
  const conds: SQL[] = [visibleTo(userId)];
  if ('activityIds' in input) conds.push(inArray(activity.id, input.activityIds));
  const ids = await db
    .select({ id: activity.id })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .where(and(...conds));
  if (ids.length === 0) return;
  await db
    .insert(inboxReads)
    .values(ids.map((row) => ({ userId, activityId: row.id })))
    .onConflictDoNothing();
}
