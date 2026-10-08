import { issueCreateSchema, issueFiltersSchema } from '@tm/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../current-user';
import { createIssue, getIssueByKey, listIssues } from '../services/issues';

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
}
