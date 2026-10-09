import { sql } from 'drizzle-orm';
import type { DbOrTx } from './client';

export async function truncateAll(db: DbOrTx): Promise<void> {
  await db.execute(
    sql`truncate table inbox_reads, activity, comments, issue_labels, issues, labels, cycles, projects, views, teams, users restart identity cascade`,
  );
}
