import { env } from '../src/config';
import { runMigrations } from '../src/db/migrate';

await runMigrations(env.databaseUrl);
console.log('✓ migrations applied');
