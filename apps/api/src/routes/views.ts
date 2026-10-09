import { idParamsSchema, viewCreateSchema, viewUpdateSchema, type View } from '@tm/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { views } from '../db/schema';
import { notFound } from '../errors';
import { assertTeamExists } from '../services/refs';

function toView(row: typeof views.$inferSelect): View {
  return { id: row.id, name: row.name, filters: row.filters, createdAt: row.createdAt.toISOString() };
}

export async function viewRoutes(app: FastifyInstance) {
  app.get('/views', async () => (await app.db.select().from(views).orderBy(asc(views.createdAt))).map(toView));

  app.get('/views/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const [row] = await app.db.select().from(views).where(eq(views.id, id));
    if (!row) throw notFound('View');
    return toView(row);
  });

  app.post('/views', async (req, reply) => {
    const input = viewCreateSchema.parse(req.body);
    if (input.filters.teamId) await assertTeamExists(app.db, input.filters.teamId);
    const [row] = await app.db.insert(views).values({ name: input.name, filters: input.filters }).returning();
    return reply.status(201).send(toView(row));
  });

  app.patch('/views/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const input = viewUpdateSchema.parse(req.body);
    if (input.filters?.teamId) await assertTeamExists(app.db, input.filters.teamId);
    const [row] = await app.db.update(views).set(input).where(eq(views.id, id)).returning();
    if (!row) throw notFound('View');
    return toView(row);
  });

  app.delete('/views/:id', async (req, reply) => {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await app.db.delete(views).where(eq(views.id, id)).returning({ id: views.id });
    if (deleted.length === 0) throw notFound('View');
    return reply.status(204).send();
  });
}
