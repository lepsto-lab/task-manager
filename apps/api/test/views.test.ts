import type { View } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

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

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  ctx.app.inject({ method, url, payload });

describe('views', () => {
  it('supports the full CRUD cycle', async () => {
    const created = await req('POST', '/api/views', {
      name: 'Urgent bugs',
      filters: { teamId: fx.dev.id, priority: ['urgent', 'high'], labelId: [fx.bug.id] },
    });
    expect(created.statusCode).toBe(201);
    const view = created.json() as View;
    expect(view).toMatchObject({
      name: 'Urgent bugs',
      filters: { teamId: fx.dev.id, priority: ['urgent', 'high'], labelId: [fx.bug.id] },
    });

    expect(((await req('GET', '/api/views')).json() as View[]).map((v) => v.id)).toEqual([view.id]);
    expect((await req('GET', `/api/views/${view.id}`)).json()).toMatchObject({ name: 'Urgent bugs' });

    const renamed = await req('PATCH', `/api/views/${view.id}`, { name: 'Hot bugs' });
    expect(renamed.json()).toMatchObject({ name: 'Hot bugs', filters: { priority: ['urgent', 'high'] } });

    const refiltered = await req('PATCH', `/api/views/${view.id}`, { filters: { status: ['todo'] } });
    expect((refiltered.json() as View).filters).toEqual({ status: ['todo'] });

    expect((await req('DELETE', `/api/views/${view.id}`)).statusCode).toBe(204);
    expect((await req('GET', `/api/views/${view.id}`)).statusCode).toBe(404);
    expect((await req('DELETE', `/api/views/${view.id}`)).statusCode).toBe(404);
  });

  it('validates names, filters and teams', async () => {
    expect((await req('POST', '/api/views', { name: '  ' })).statusCode).toBe(400);
    expect((await req('POST', '/api/views', { name: 'x', filters: { status: ['nope'] } })).statusCode).toBe(400);
    const unknownTeam = await req('POST', '/api/views', {
      name: 'x',
      filters: { teamId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' },
    });
    expect(unknownTeam.statusCode).toBe(400);
    expect((await req('PATCH', '/api/views/6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', { name: 'x' })).statusCode).toBe(404);
  });
});
