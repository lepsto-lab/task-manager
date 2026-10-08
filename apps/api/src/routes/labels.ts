import type { Label } from '@tm/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { labels } from '../db/schema';

const querySchema = z.object({ teamId: z.uuid().optional() });

export async function labelRoutes(app: FastifyInstance) {
  app.get('/labels', async (req): Promise<Label[]> => {
    const { teamId } = querySchema.parse(req.query);
    return app.db
      .select({ id: labels.id, teamId: labels.teamId, name: labels.name, color: labels.color })
      .from(labels)
      .where(teamId ? eq(labels.teamId, teamId) : undefined)
      .orderBy(asc(labels.name));
  });
}
