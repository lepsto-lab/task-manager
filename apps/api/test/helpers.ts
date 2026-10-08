import type { IssueDetail } from '@tm/shared';
import { buildApp } from '../src/app';
import { env } from '../src/config';
import { createDb, type DbOrTx } from '../src/db/client';
import * as s from '../src/db/schema';
import { truncateAll } from '../src/db/truncate';

export function openTestDb() {
  return createDb(env.testDatabaseUrl);
}

export async function resetDb(db: DbOrTx) {
  await truncateAll(db);
}

export async function seedFixture(db: DbOrTx) {
  const [alice, bob] = await db
    .insert(s.users)
    .values([
      { name: 'Alice Doe', initials: 'AD', color: '#6D4FC2' },
      { name: 'Bob Roe', initials: 'BR', color: '#2F7D6D' },
    ])
    .returning();
  const [dev, des] = await db
    .insert(s.teams)
    .values([
      { name: 'Engineering', key: 'DEV', color: '#2F7D6D' },
      { name: 'Design', key: 'DES', color: '#B5582F' },
    ])
    .returning();
  const [bug, feat] = await db
    .insert(s.labels)
    .values([
      { teamId: dev.id, name: 'Bug', color: '#EB5757' },
      { teamId: dev.id, name: 'Feature', color: '#A78BFA' },
    ])
    .returning();
  const [brand] = await db.insert(s.labels).values({ teamId: des.id, name: 'Brand', color: '#F07CB4' }).returning();
  const [project] = await db.insert(s.projects).values({ teamId: dev.id, name: 'Mobile app 2.0' }).returning();
  const [cycle] = await db
    .insert(s.cycles)
    .values({ teamId: dev.id, number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' })
    .returning();
  return { alice, bob, dev, des, bug, feat, brand, project, cycle };
}

export type Fixture = Awaited<ReturnType<typeof seedFixture>>;

let counter = 0;

export async function insertIssue(
  db: DbOrTx,
  values: Partial<typeof s.issues.$inferInsert> & { teamId: string; creatorId: string },
) {
  counter += 1;
  const [row] = await db
    .insert(s.issues)
    .values({ number: 10_000 + counter, title: `Issue ${counter}`, sortOrder: counter * 1000, ...values })
    .returning();
  return row;
}

export async function createTestApp() {
  const { db, pool } = openTestDb();
  const app = await buildApp({ db });
  await app.ready();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestApp>>;

export function as(user: { id: string }) {
  return { 'x-user-id': user.id };
}

export async function createIssueVia(
  ctx: TestContext,
  user: { id: string },
  body: Record<string, unknown>,
): Promise<IssueDetail> {
  const res = await ctx.app.inject({ method: 'POST', url: '/api/issues', headers: as(user), payload: body });
  if (res.statusCode !== 201) throw new Error(`create failed: ${res.statusCode} ${res.body}`);
  return res.json() as IssueDetail;
}
