import type { Team } from '@tm/shared';
import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { teams } from '../db/schema';

export async function teamRoutes(app: FastifyInstance) {
  app.get(
    '/teams',
    async (): Promise<Team[]> =>
      app.db
        .select({ id: teams.id, name: teams.name, key: teams.key, color: teams.color })
        .from(teams)
        .orderBy(asc(teams.name)),
  );
}
