import type { IssueDetail, InboxResponse } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;
let mine: IssueDetail;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
  // Bob creates an issue assigned to Alice, then changes its status.
  mine = await createIssueVia(ctx, fx.bob, { teamId: fx.dev.id, title: 'For Alice', assigneeId: fx.alice.id });
  await ctx.app.inject({
    method: 'PATCH',
    url: `/api/issues/${mine.id}`,
    headers: as(fx.bob),
    payload: { status: 'in_progress' },
  });
  // Alice's own action must not appear in her inbox.
  await ctx.app.inject({
    method: 'PATCH',
    url: `/api/issues/${mine.id}`,
    headers: as(fx.alice),
    payload: { priority: 'high' },
  });
});

const inbox = async (user: { id: string }) => {
  const res = await ctx.app.inject({ method: 'GET', url: '/api/inbox', headers: as(user) });
  expect(res.statusCode).toBe(200);
  return res.json() as InboxResponse;
};

const markRead = (user: { id: string }, payload: unknown) =>
  ctx.app.inject({ method: 'POST', url: '/api/inbox/read', headers: as(user), payload: payload as object });

describe('inbox', () => {
  it("shows other people's activity on my issues, newest first", async () => {
    const data = await inbox(fx.alice);
    expect(data.unreadCount).toBe(2);
    expect(data.items.map((i) => i.activity.type)).toEqual(['status', 'created']);
    expect(data.items[0]).toMatchObject({
      read: false,
      issue: { id: mine.id, key: mine.key, title: 'For Alice', status: 'in_progress' },
      activity: { actor: { id: fx.bob.id } },
    });
  });

  it('shows the creator activity by others on issues they created', async () => {
    const data = await inbox(fx.bob);
    expect(data.items.map((i) => i.activity.type)).toEqual(['priority']);
  });

  it('marks selected items as read', async () => {
    const before = await inbox(fx.alice);
    const res = await markRead(fx.alice, { activityIds: [before.items[0].activity.id] });
    expect(res.statusCode).toBe(204);
    const after = await inbox(fx.alice);
    expect(after.unreadCount).toBe(1);
    expect(after.items[0].read).toBe(true);
  });

  it('marks everything as read and ignores ids the user cannot see', async () => {
    const bobItems = await inbox(fx.bob);
    expect((await markRead(fx.alice, { activityIds: [bobItems.items[0].activity.id] })).statusCode).toBe(204);
    expect((await inbox(fx.alice)).unreadCount).toBe(2);
    expect((await markRead(fx.alice, { all: true })).statusCode).toBe(204);
    expect((await inbox(fx.alice)).unreadCount).toBe(0);
  });

  it('requires a current user', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/inbox' })).statusCode).toBe(400);
    expect((await markRead(fx.alice, {})).statusCode).toBe(400);
  });
});
