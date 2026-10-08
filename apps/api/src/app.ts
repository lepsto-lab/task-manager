import Fastify from 'fastify';
import { ZodError } from 'zod';
import type { DbOrTx } from './db/client';
import { HttpError } from './errors';
import { cycleRoutes } from './routes/cycles';
import { labelRoutes } from './routes/labels';
import { projectRoutes } from './routes/projects';
import { teamRoutes } from './routes/teams';
import { userRoutes } from './routes/users';

declare module 'fastify' {
  interface FastifyInstance {
    db: DbOrTx;
  }
}

export interface AppOptions {
  db: DbOrTx;
  logger?: boolean;
}

export async function buildApp({ db, logger = false }: AppOptions) {
  const app = Fastify({ logger });
  app.decorate('db', db);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply
        .status(400)
        .send({ error: { code: 'validation_error', message: 'Invalid request', details: err.issues } });
    }
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    }
    const e = err as Error & { statusCode?: number };
    const status = typeof e.statusCode === 'number' ? e.statusCode : 500;
    if (status < 500) {
      return reply.status(status).send({ error: { code: 'bad_request', message: e.message } });
    }
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'internal', message: 'Internal server error' } });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: { code: 'not_found', message: 'Route not found' } }),
  );

  await app.register(
    async (api) => {
      await api.register(userRoutes);
      await api.register(teamRoutes);
      await api.register(labelRoutes);
      await api.register(projectRoutes);
      await api.register(cycleRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
