import { idParamsSchema, projectCreateSchema, type Project } from '@tm/shared';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbOrTx } from '../db/client';
import { issues, projects } from '../db/schema';
import { notFound } from '../errors';
import { assertTeamExists } from '../services/refs';

const querySchema = z.object({ teamId: z.uuid().optional() });

async function queryProjects(db: DbOrTx, where?: SQL): Promise<Project[]> {
  const rows = await db
    .select({
      id: projects.id,
      teamId: projects.teamId,
      name: projects.name,
      createdAt: projects.createdAt,
      issueCount: sql<number>`count(${issues.id})::int`,
      doneCount: sql<number>`(count(${issues.id}) filter (where ${issues.status} = 'done'))::int`,
    })
    .from(projects)
    .leftJoin(issues, eq(issues.projectId, projects.id))
    .where(where)
    .groupBy(projects.id)
    .orderBy(asc(projects.name));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', async (req) => {
    const { teamId } = querySchema.parse(req.query);
    return queryProjects(app.db, teamId ? eq(projects.teamId, teamId) : undefined);
  });

  app.get('/projects/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const [project] = await queryProjects(app.db, eq(projects.id, id));
    if (!project) throw notFound('Project');
    return project;
  });

  app.post('/projects', async (req, reply) => {
    const input = projectCreateSchema.parse(req.body);
    await assertTeamExists(app.db, input.teamId);
    const [row] = await app.db.insert(projects).values(input).returning({ id: projects.id });
    const [project] = await queryProjects(app.db, eq(projects.id, row.id));
    return reply.status(201).send(project);
  });
}
