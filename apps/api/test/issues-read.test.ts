import type { IssueDetail, IssueListItem } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;
let crash: IssueDetail;
let offline: IssueDetail;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
  crash = await createIssueVia(ctx, fx.alice, {
    teamId: fx.dev.id,
    title: 'Crash',
    status: 'in_progress',
    priority: 'urgent',
    assigneeId: fx.alice.id,
    labelIds: [fx.bug.id],
    projectId: fx.project.id,
    cycleId: fx.cycle.id,
  });
  offline = await createIssueVia(ctx, fx.alice, {
    teamId: fx.dev.id,
    title: 'Offline',
    priority: 'high',
    assigneeId: fx.bob.id,
    labelIds: [fx.feat.id],
  });
  await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Docs', status: 'backlog' });
  await createIssueVia(ctx, fx.alice, { teamId: fx.des.id, title: 'Icons' });
});

const list = async (query: string, headers: Record<string, string> = {}) => {
  const res = await ctx.app.inject({ method: 'GET', url: `/api/issues${query}`, headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as IssueListItem[]).map((i) => i.title);
};

describe('GET /api/issues', () => {
  it('filters by team', async () => {
    expect(await list(`?teamId=${fx.dev.id}`)).toHaveLength(3);
  });

  it('filters by multiple statuses', async () => {
    expect((await list(`?teamId=${fx.dev.id}&status=todo&status=backlog`)).sort()).toEqual(['Docs', 'Offline']);
  });

  it('filters by priority, assignee, label, project and cycle', async () => {
    expect(await list('?priority=urgent')).toEqual(['Crash']);
    expect(await list(`?assigneeId=${fx.bob.id}`)).toEqual(['Offline']);
    expect(await list(`?labelId=${fx.feat.id}`)).toEqual(['Offline']);
    expect(await list(`?projectId=${fx.project.id}`)).toEqual(['Crash']);
    expect(await list(`?cycleId=${fx.cycle.id}`)).toEqual(['Crash']);
  });

  it('filters mine using the current user', async () => {
    expect(await list('?mine=true', as(fx.bob))).toEqual(['Offline']);
  });

  it('requires a current user for mine=true', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/issues?mine=true' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('user_required');
  });

  it('orders issues by sortOrder within the result', async () => {
    await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Later' });
    expect(await list(`?teamId=${fx.dev.id}&status=todo`)).toEqual(['Offline', 'Later']);
  });

  it('returns list items with key, labels and assignee', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/issues?priority=urgent` });
    const [item] = res.json() as IssueListItem[];
    expect(item).toMatchObject({
      key: 'DEV-1',
      status: 'in_progress',
      assignee: { id: fx.alice.id },
      labels: [{ name: 'Bug', color: '#EB5757' }],
    });
    expect(typeof item.createdAt).toBe('string');
  });

  it('rejects invalid filter values', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/issues?status=nope' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/issues/:key', () => {
  it('returns details with parent and children', async () => {
    const child = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Child', parentId: offline.id });
    const parent = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${offline.key}` })).json() as IssueDetail;
    expect(parent.children.map((c) => c.key)).toEqual([child.key]);
    const fetched = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${child.key}` })).json() as IssueDetail;
    expect(fetched.parent).toEqual({ id: offline.id, key: offline.key, title: 'Offline', status: 'todo' });
  });

  it('accepts lowercase keys', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/issues/${crash.key.toLowerCase()}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(crash.id);
  });

  it.each(['DEV-999', 'garbage', 'dev-0', 'XYZ-1'])('returns 404 for %s', async (key) => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/issues/${key}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Issue not found' } });
  });
});
