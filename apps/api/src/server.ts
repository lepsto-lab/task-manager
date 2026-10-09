import { buildApp } from './app';
import { env } from './config';
import { createDb } from './db/client';

const { db } = createDb(env.databaseUrl);
const app = await buildApp({ db, logger: true, webDist: env.webDist });
await app.listen({ port: env.port, host: env.host });
