import { asc } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { teams, users } from '../src/db/schema';
import { seed } from '../src/db/seed';
import { getInbox } from '../src/services/inbox';
import { createIssue, getIssueByKey, listIssues } from '../src/services/issues';
import { openTestDb } from './helpers';

const { db, pool } = openTestDb();

beforeAll(async () => {
  await seed(db);
  await seed(db); // idempotent
});
afterAll(async () => {
  await pool.end();
});

describe('seed', () => {
  it('creates the mockup data', async () => {
    expect(await db.select().from(users)).toHaveLength(4);
    const issue = await getIssueByKey(db, 'DEV-142');
    expect(issue).toMatchObject({
      title: 'Offline sync for issues',
      status: 'in_progress',
      priority: 'high',
      estimate: 5,
      dueDate: '2026-10-17',
      project: { name: 'Mobile app 2.0' },
      cycle: { number: 14 },
      assignee: { name: 'Anna Romanova' },
    });
    expect(issue.labels.map((l) => l.name)).toEqual(['Feature', 'Mobile']);
    expect(issue.children.map((c) => c.key)).toEqual(['DEV-143', 'DEV-144', 'DEV-145']);
    expect(issue.comments).toHaveLength(1);
    expect(issue.activity.map((a) => a.type)).toEqual(['created', 'status', 'comment']);
  });

  it('continues numbering after the highest seeded number', async () => {
    const all = await listIssues(db, {}, null);
    expect(all.filter((i) => i.key.startsWith('DEV-'))).toHaveLength(17);
    expect(all.filter((i) => i.key.startsWith('DES-'))).toHaveLength(2);
  });

  it('orders teams by creation and continues the DEV counter', async () => {
    const rows = await db.select().from(teams).orderBy(asc(teams.createdAt));
    expect(rows.map((t) => t.key)).toEqual(['DEV', 'DES']);
    expect(rows[0].issueCounter).toBe(161);
    const [anna] = (await db.select().from(users)).filter((u) => u.initials === 'AR');
    const created = await createIssue(db, { teamId: rows[0].id, title: 'Next one' }, anna.id);
    expect(created.key).toBe('DEV-162');
  });

  it('gives Anna three unread inbox items', async () => {
    const [anna] = (await db.select().from(users)).filter((u) => u.initials === 'AR');
    const inbox = await getInbox(db, anna.id);
    expect(inbox.unreadCount).toBe(3);
  });
});
