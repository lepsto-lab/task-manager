import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema';

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];
/** Accepts both the root database and a transaction handle. */
export type DbOrTx = PgDatabase<NodePgQueryResultHKT, typeof schema>;
