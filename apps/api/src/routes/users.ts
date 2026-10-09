import type { User } from '@tm/shared';
import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { userColumns } from '../db/columns';
import { users } from '../db/schema';

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', async (): Promise<User[]> => app.db.select(userColumns).from(users).orderBy(asc(users.name)));
}
