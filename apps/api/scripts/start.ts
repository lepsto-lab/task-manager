// Production entrypoint: apply migrations, load demo data into an empty database, then serve.
import { count } from 'drizzle-orm';
import { env } from '../src/config';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { users } from '../src/db/schema';
import { seed } from '../src/db/seed';

await runMigrations(env.databaseUrl);
console.log('✓ migrations applied');

const { db, pool } = createDb(env.databaseUrl);
const [{ n }] = await db.select({ n: count() }).from(users);
if (n === 0) {
  await seed(db);
  console.log('✓ seed data loaded');
}
await pool.end();

await import('../src/server');
