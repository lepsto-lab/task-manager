# Task Manager

A Linear-style task manager: issue list, kanban board, issue details, inbox, my issues, projects, cycles and saved views.

## Stack

- `packages/shared` — zod schemas, constants and DTO types shared by both apps
- `apps/api` — Fastify 5 + Drizzle ORM on PostgreSQL
- `apps/web` — React 19 + Vite, React Router, TanStack Query, dnd-kit

## Requirements

- Node 26+, pnpm 11+
- A local PostgreSQL (17 tested) reachable without a password by the current OS user

## Getting started

```bash
pnpm install
cp .env.example .env      # adjust DATABASE_URL / DATABASE_URL_TEST if needed
pnpm db:setup             # creates taskmanager + taskmanager_test, migrates, loads seed data
pnpm dev                  # API on :3001, web on http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | API (tsx watch) and web (Vite) together |
| `pnpm test` | All test suites (API tests use `DATABASE_URL_TEST`) |
| `pnpm typecheck` / `pnpm lint` | Type checking / ESLint |
| `pnpm db:generate` | Generate a migration after changing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm db:seed` | Reset the dev database to the demo data |

## Notes

- There is no authentication yet. The current user is picked in the sidebar footer and sent to the API as the `X-User-Id` header.
- Search and "Invite people" are placeholders.
