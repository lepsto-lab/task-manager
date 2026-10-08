import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { teams } from '../db/schema';
import { badRequest } from '../errors';

export async function assertTeamExists(db: DbOrTx, teamId: string): Promise<void> {
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId));
  if (!team) throw badRequest('Unknown team');
}
