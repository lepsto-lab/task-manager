import { env } from '../src/config';
import { ensureDatabase } from '../src/db/ensure';
import { runMigrations } from '../src/db/migrate';

for (const url of [env.databaseUrl, env.testDatabaseUrl]) {
  await ensureDatabase(url);
  await runMigrations(url);
  console.log(`✓ ${new URL(url).pathname.slice(1)} is ready`);
}
