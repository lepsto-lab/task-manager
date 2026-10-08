import { idParamsSchema, type Cycle } from '@tm/shared';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbOrTx } from '../db/client';
import { cycles, issues } from '../db/schema';
import { notFound } from '../errors';

const querySchema = z.object({ teamId: z.uuid().optional() });

async function queryCycles(db: DbOrTx, where?: SQL): Promise<Cycle[]> {
  return db
    .select({
      id: cycles.id,
      teamId: cycles.teamId,
      number: cycles.number,
      startsOn: cycles.startsOn,
      endsOn: cycles.endsOn,
      issueCount: sql<number>`count(${issues.id})::int`,
      doneCount: sql<number>`(count(${issues.id}) filter (where ${issues.status} = 'done'))::int`,
    })
    .from(cycles)
    .leftJoin(issues, eq(issues.cycleId, cycles.id))
    .where(where)
    .groupBy(cycles.id)
    .orderBy(asc(cycles.number));
}

export async function cycleRoutes(app: FastifyInstance) {
  app.get('/cycles', async (req) => {
    const { teamId } = querySchema.parse(req.query);
    return queryCycles(app.db, teamId ? eq(cycles.teamId, teamId) : undefined);
  });

  app.get('/cycles/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const [cycle] = await queryCycles(app.db, eq(cycles.id, id));
    if (!cycle) throw notFound('Cycle');
    return cycle;
  });
}
