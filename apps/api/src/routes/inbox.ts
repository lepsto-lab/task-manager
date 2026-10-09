import { inboxReadSchema } from '@tm/shared';
import type { FastifyInstance } from 'fastify';
import { requireUserId } from '../current-user';
import { getInbox, markInboxRead } from '../services/inbox';

export async function inboxRoutes(app: FastifyInstance) {
  app.get('/inbox', async (req) => getInbox(app.db, await requireUserId(app, req)));

  app.post('/inbox/read', async (req, reply) => {
    const userId = await requireUserId(app, req);
    await markInboxRead(app.db, userId, inboxReadSchema.parse(req.body));
    return reply.status(204).send();
  });
}
