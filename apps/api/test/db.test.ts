import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as s from '../src/db/schema';
import { openTestDb, resetDb, seedFixture } from './helpers';

const { db, pool } = openTestDb();

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetDb(db);
});

describe('database schema', () => {
  it('creates teams with a zero issue counter', async () => {
    const fx = await seedFixture(db);
    expect(fx.dev.key).toBe('DEV');
    expect(fx.dev.issueCounter).toBe(0);
  });

  it('enforces unique team keys', async () => {
    await seedFixture(db);
    await expect(db.insert(s.teams).values({ name: 'Dup', key: 'DEV', color: '#000000' }).execute()).rejects.toThrow();
  });

  it('enforces unique issue numbers per team', async () => {
    const fx = await seedFixture(db);
    const row = { teamId: fx.dev.id, number: 1, title: 'A', creatorId: fx.alice.id, sortOrder: 1000 };
    await db.insert(s.issues).values(row).execute();
    await expect(db.insert(s.issues).values(row).execute()).rejects.toThrow();
  });
});
