import { commentCreateSchema, idParamsSchema, issueCreateSchema, issueFiltersSchema, issueUpdateSchema } from '@tm/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../current-user';
import { addComment, createIssue, deleteIssue, getIssueByKey, listIssues, updateIssue } from '../services/issues';

const keyParams = z.object({ id: z.string() });

export async function issueRoutes(app: FastifyInstance) {
  app.get('/issues', async (req) => {
    const filters = issueFiltersSchema.parse(req.query);
    const userId = filters.mine ? await requireUserId(app, req) : null;
    return listIssues(app.db, filters, userId);
  });

  // `:id` carries the human key here (e.g. DEV-142); mutations below use the uuid.
  app.get('/issues/:id', async (req) => getIssueByKey(app.db, keyParams.parse(req.params).id));

  app.post('/issues', async (req, reply) => {
    const userId = await requireUserId(app, req);
    const input = issueCreateSchema.parse(req.body);
    return reply.status(201).send(await createIssue(app.db, input, userId));
  });

  app.patch('/issues/:id', async (req) => {
    const userId = await requireUserId(app, req);
    const { id } = idParamsSchema.parse(req.params);
    return updateIssue(app.db, id, issueUpdateSchema.parse(req.body), userId);
  });

  app.delete('/issues/:id', async (req, reply) => {
    await requireUserId(app, req);
    const { id } = idParamsSchema.parse(req.params);
    await deleteIssue(app.db, id);
    return reply.status(204).send();
  });

  app.post('/issues/:id/comments', async (req, reply) => {
    const userId = await requireUserId(app, req);
    const { id } = idParamsSchema.parse(req.params);
    const { body } = commentCreateSchema.parse(req.body);
    return reply.status(201).send(await addComment(app.db, id, body, userId));
  });
}
