import type { CommentDto, IssueDetail } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;
let issue: IssueDetail;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
  issue = await createIssueVia(ctx, fx.alice, {
    teamId: fx.dev.id,
    title: 'Target',
    priority: 'medium',
    assigneeId: fx.alice.id,
    labelIds: [fx.bug.id],
    projectId: fx.project.id,
    cycleId: fx.cycle.id,
    dueDate: '2026-10-17',
    estimate: 3,
  });
});

const patch = (id: string, body: Record<string, unknown>, headers: Record<string, string> = as(fx.bob)) =>
  ctx.app.inject({ method: 'PATCH', url: `/api/issues/${id}`, headers, payload: body });

const ok = async (id: string, body: Record<string, unknown>) => {
  const res = await patch(id, body);
  expect(res.statusCode).toBe(200);
  return res.json() as IssueDetail;
};

describe('PATCH /api/issues/:id', () => {
  it('records a status change and moves the issue to the bottom of the new status', async () => {
    await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Busy', status: 'in_progress' });
    const updated = await ok(issue.id, { status: 'in_progress' });
    expect(updated.status).toBe('in_progress');
    expect(updated.sortOrder).toBe(2000);
    expect(updated.activity.at(-1)).toMatchObject({
      type: 'status',
      payload: { from: 'todo', to: 'in_progress' },
      actor: { id: fx.bob.id },
    });
  });

  it('uses an explicit sortOrder when given', async () => {
    const updated = await ok(issue.id, { status: 'done', sortOrder: 1500 });
    expect(updated).toMatchObject({ status: 'done', sortOrder: 1500 });
  });

  it('clears nullable fields and describes the removals', async () => {
    const updated = await ok(issue.id, {
      assigneeId: null,
      dueDate: null,
      estimate: null,
      projectId: null,
      cycleId: null,
    });
    expect(updated).toMatchObject({
      assignee: null,
      dueDate: null,
      estimate: null,
      projectId: null,
      project: null,
      cycleId: null,
      cycle: null,
    });
    const payloads = Object.fromEntries(updated.activity.map((a) => [a.type, a.payload]));
    expect(payloads.assignee).toEqual({ from: 'Alice Doe', to: null });
    expect(payloads.due_date).toEqual({ from: '2026-10-17', to: null });
    expect(payloads.estimate).toEqual({ from: 3, to: null });
    expect(payloads.project).toEqual({ from: 'Mobile app 2.0', to: null });
    expect(payloads.cycle).toEqual({ from: 'Cycle 14', to: null });
  });

  it('diffs labels and skips unchanged label sets', async () => {
    const updated = await ok(issue.id, { labelIds: [fx.feat.id] });
    expect(updated.labels.map((l) => l.name)).toEqual(['Feature']);
    expect(updated.activity.at(-1)).toMatchObject({ type: 'labels', payload: { added: ['Feature'], removed: ['Bug'] } });
    const again = await ok(issue.id, { labelIds: [fx.feat.id] });
    expect(again.activity).toHaveLength(updated.activity.length);
  });

  it('does not record no-op changes', async () => {
    const updated = await ok(issue.id, { status: 'todo', priority: 'medium', title: 'Target' });
    expect(updated.activity.map((a) => a.type)).toEqual(['created']);
  });

  it('updates the description without an activity entry', async () => {
    const updated = await ok(issue.id, { description: 'Steps to reproduce' });
    expect(updated.description).toBe('Steps to reproduce');
    expect(updated.activity).toHaveLength(1);
    expect(updated.updatedAt > issue.updatedAt).toBe(true);
  });

  it('records renames and priority changes', async () => {
    const updated = await ok(issue.id, { title: 'Renamed', priority: 'urgent' });
    const payloads = Object.fromEntries(updated.activity.map((a) => [a.type, a.payload]));
    expect(payloads.title).toEqual({ from: 'Target', to: 'Renamed' });
    expect(payloads.priority).toEqual({ from: 'medium', to: 'urgent' });
  });

  it('records parent changes by key', async () => {
    const parent = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Parent' });
    const updated = await ok(issue.id, { parentId: parent.id });
    expect(updated.parent?.key).toBe(parent.key);
    expect(updated.activity.at(-1)).toMatchObject({ type: 'parent', payload: { from: null, to: parent.key } });
  });

  it('rejects self and circular parents', async () => {
    const child = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Child', parentId: issue.id });
    expect((await patch(issue.id, { parentId: issue.id })).statusCode).toBe(409);
    expect((await patch(issue.id, { parentId: child.id })).statusCode).toBe(409);
  });

  it('validates input', async () => {
    expect((await patch(issue.id, {})).statusCode).toBe(400);
    expect((await patch(issue.id, { status: 'nope' })).statusCode).toBe(400);
    expect((await patch(issue.id, { labelIds: [fx.brand.id] })).statusCode).toBe(400);
    expect((await patch('6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', { title: 'x' })).statusCode).toBe(404);
    expect((await patch(issue.id, { title: 'x' }, {})).statusCode).toBe(400);
  });
});

describe('DELETE /api/issues/:id', () => {
  it('deletes the issue and detaches its children', async () => {
    const child = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Child', parentId: issue.id });
    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/issues/${issue.id}`, headers: as(fx.bob) });
    expect(res.statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/issues/${issue.key}` })).statusCode).toBe(404);
    const orphan = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${child.key}` })).json() as IssueDetail;
    expect(orphan.parent).toBeNull();
    const again = await ctx.app.inject({ method: 'DELETE', url: `/api/issues/${issue.id}`, headers: as(fx.bob) });
    expect(again.statusCode).toBe(404);
  });
});

describe('POST /api/issues/:id/comments', () => {
  const comment = (id: string, body: unknown, headers: Record<string, string> = as(fx.bob)) =>
    ctx.app.inject({ method: 'POST', url: `/api/issues/${id}/comments`, headers, payload: { body } });

  it('adds a comment with its author and a comment activity', async () => {
    const res = await comment(issue.id, '  Looks good  ');
    expect(res.statusCode).toBe(201);
    const created = res.json() as CommentDto;
    expect(created).toMatchObject({ body: 'Looks good', author: { id: fx.bob.id, name: 'Bob Roe' } });
    const detail = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${issue.key}` })).json() as IssueDetail;
    expect(detail.comments.map((c) => c.id)).toEqual([created.id]);
    expect(detail.activity.at(-1)).toMatchObject({ type: 'comment', payload: { commentId: created.id } });
  });

  it('rejects blank comments, unknown issues and missing users', async () => {
    expect((await comment(issue.id, '   ')).statusCode).toBe(400);
    expect((await comment('6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', 'hi')).statusCode).toBe(404);
    expect((await comment(issue.id, 'hi', {})).statusCode).toBe(400);
  });
});
