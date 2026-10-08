import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/taskmanager',
  testDatabaseUrl: process.env.DATABASE_URL_TEST ?? 'postgres://localhost:5432/taskmanager_test',
  port: Number(process.env.API_PORT ?? 3001),
};
