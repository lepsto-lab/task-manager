import { buildApp } from './app';
import { env } from './config';
import { createDb } from './db/client';

const { db } = createDb(env.databaseUrl);
const app = await buildApp({ db, logger: true });
await app.listen({ port: env.port, host: '127.0.0.1' });
