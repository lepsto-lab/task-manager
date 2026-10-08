import { env } from '../src/config';
import { ensureDatabase } from '../src/db/ensure';
import { runMigrations } from '../src/db/migrate';

export default async function setup() {
  await ensureDatabase(env.testDatabaseUrl);
  await runMigrations(env.testDatabaseUrl);
}
