import { env } from '../src/config';
import { createDb } from '../src/db/client';
import { seed } from '../src/db/seed';

const { db, pool } = createDb(env.databaseUrl);
await seed(db);
await pool.end();
console.log('✓ seed data loaded');
