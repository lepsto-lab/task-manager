import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
});

const post = (body: Record<string, unknown>, headers: Record<string, string> = as(fx.alice)) =>
  ctx.app.inject({ method: 'POST', url: '/api/issues', headers, payload: body });

describe('POST /api/issues', () => {
  it('assigns sequential numbers per team', async () => {
    const a = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'One' });
    const b = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Two' });
    const c = await createIssueVia(ctx, fx.alice, { teamId: fx.des.id, title: 'Three' });
    expect([a.key, b.key, c.key]).toEqual(['DEV-1', 'DEV-2', 'DES-1']);
  });

  it('never duplicates numbers under concurrent creation', async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: `C${i}` })),
    );
    expect(created.map((i) => i.number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('applies defaults and records a created activity', async () => {
    const issue = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Defaults' });
    expect(issue).toMatchObject({
      status: 'todo',
      priority: 'none',
      description: '',
      assignee: null,
      labels: [],
      sortOrder: 1000,
      creator: { id: fx.alice.id, name: 'Alice Doe' },
    });
    expect(issue.activity.map((a) => a.type)).toEqual(['created']);
  });

  it('places new issues at the bottom of their status column', async () => {
    await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'First' });
    const second = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Second' });
    const backlog = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'B', status: 'backlog' });
    expect(second.sortOrder).toBe(2000);
    expect(backlog.sortOrder).toBe(1000);
  });

  it('stores labels and references', async () => {
    const issue = await createIssueVia(ctx, fx.alice, {
      teamId: fx.dev.id,
      title: 'Full',
      priority: 'high',
      assigneeId: fx.bob.id,
      labelIds: [fx.feat.id, fx.bug.id],
      projectId: fx.project.id,
      cycleId: fx.cycle.id,
      dueDate: '2026-10-17',
      estimate: 5,
    });
    expect(issue.labels.map((l) => l.name)).toEqual(['Bug', 'Feature']);
    expect(issue.assignee).toEqual({ id: fx.bob.id, name: 'Bob Roe', initials: 'BR', color: '#2F7D6D' });
    expect(issue.project).toEqual({ id: fx.project.id, name: 'Mobile app 2.0' });
    expect(issue.cycle).toMatchObject({ number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' });
    expect(issue).toMatchObject({ dueDate: '2026-10-17', estimate: 5, priority: 'high' });
  });

  it('requires a current user', async () => {
    const res = await post({ teamId: fx.dev.id, title: 'x' }, {});
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('user_required');
  });

  it('rejects an unknown current user', async () => {
    const res = await post({ teamId: fx.dev.id, title: 'x' }, { 'x-user-id': '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('unknown_user');
  });

  it('rejects blank titles', async () => {
    const res = await post({ teamId: fx.dev.id, title: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
  });

  it('rejects an unknown team', async () => {
    const res = await post({ teamId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', title: 'x' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Unknown team');
  });

  it('rejects labels of another team', async () => {
    const res = await post({ teamId: fx.dev.id, title: 'x', labelIds: [fx.brand.id] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_request');
  });

  it('rejects a parent from another team with 409', async () => {
    const parent = await createIssueVia(ctx, fx.alice, { teamId: fx.des.id, title: 'Design parent' });
    const res = await post({ teamId: fx.dev.id, title: 'Child', parentId: parent.id });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('conflict');
  });
});
