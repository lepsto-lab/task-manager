import type { Cycle, Label, Project, Team, User } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, insertIssue, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

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

const get = (url: string) => ctx.app.inject({ method: 'GET', url });

describe('reference endpoints', () => {
  it('lists users sorted by name', async () => {
    const res = await get('/api/users');
    expect(res.statusCode).toBe(200);
    expect((res.json() as User[]).map((u) => u.name)).toEqual(['Alice Doe', 'Bob Roe']);
  });

  it('lists teams in creation order with keys and colors', async () => {
    const teams = (await get('/api/teams')).json() as Team[];
    expect(teams).toEqual([
      { id: fx.dev.id, name: 'Engineering', key: 'DEV', color: '#2F7D6D' },
      { id: fx.des.id, name: 'Design', key: 'DES', color: '#B5582F' },
    ]);
  });

  it('filters labels by team', async () => {
    const labels = (await get(`/api/labels?teamId=${fx.dev.id}`)).json() as Label[];
    expect(labels.map((l) => l.name)).toEqual(['Bug', 'Feature']);
    expect(((await get('/api/labels')).json() as Label[]).length).toBe(3);
  });

  it('returns a validation error for a malformed teamId', async () => {
    const res = await get('/api/labels?teamId=nope');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
  });

  it('lists projects with issue progress', async () => {
    await insertIssue(ctx.db, { teamId: fx.dev.id, creatorId: fx.alice.id, projectId: fx.project.id, status: 'done' });
    await insertIssue(ctx.db, { teamId: fx.dev.id, creatorId: fx.alice.id, projectId: fx.project.id });
    const [project] = (await get(`/api/projects?teamId=${fx.dev.id}`)).json() as Project[];
    expect(project).toMatchObject({ name: 'Mobile app 2.0', issueCount: 2, doneCount: 1 });
    expect((await get(`/api/projects/${fx.project.id}`)).json()).toMatchObject({ id: fx.project.id });
  });

  it('creates a project', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { teamId: fx.des.id, name: '  Brand refresh ' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Brand refresh', teamId: fx.des.id, issueCount: 0, doneCount: 0 });
  });

  it('rejects a project for an unknown team', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { teamId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', name: 'X' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_request');
  });

  it('returns 404 for an unknown project', async () => {
    const res = await get('/api/projects/6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Project not found' } });
  });

  it('lists cycles with progress', async () => {
    await insertIssue(ctx.db, { teamId: fx.dev.id, creatorId: fx.alice.id, cycleId: fx.cycle.id, status: 'done' });
    const [cycle] = (await get(`/api/cycles?teamId=${fx.dev.id}`)).json() as Cycle[];
    expect(cycle).toEqual({
      id: fx.cycle.id,
      teamId: fx.dev.id,
      number: 14,
      startsOn: '2026-10-06',
      endsOn: '2026-10-19',
      issueCount: 1,
      doneCount: 1,
    });
    expect((await get(`/api/cycles/${fx.cycle.id}`)).json()).toMatchObject({ number: 14 });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await get('/api/nothing-here');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });
});
