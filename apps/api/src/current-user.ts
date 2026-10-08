import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { users } from './db/schema';
import { HttpError } from './errors';

const uuid = z.uuid();

export async function requireUserId(app: FastifyInstance, req: FastifyRequest): Promise<string> {
  const raw = req.headers['x-user-id'];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !uuid.safeParse(id).success) {
    throw new HttpError(400, 'user_required', 'X-User-Id header is required');
  }
  const [user] = await app.db.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!user) throw new HttpError(400, 'unknown_user', 'Unknown user');
  return id;
}
