# Task Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Linear-style task manager (issue list, board, issue detail, inbox, my issues, projects, cycles, saved views) in a TypeScript pnpm monorepo backed by local Postgres, without authentication.

**Architecture:** `packages/shared` holds zod schemas, constants and DTO types consumed as TS source by both apps. `apps/api` is a Fastify 5 REST API over Drizzle ORM (node-postgres) with services for business logic (numbering, activity log, inbox) and integration tests through `app.inject()` against a dedicated test database. `apps/web` is a React 19 SPA (Vite 7) using React Router 7, TanStack Query 5 with optimistic mutations, @dnd-kit for the board, CSS Modules + design tokens taken verbatim from the mockups; tests run in Vitest + Testing Library against an MSW in-memory backend.

**Tech Stack:** Node 26, pnpm 11, TypeScript 5.9, zod 4, Fastify 5, drizzle-orm 0.45 / drizzle-kit 0.31, pg 8, PostgreSQL 17, React 19, react-router 7, @tanstack/react-query 5, @dnd-kit/core 6 + @dnd-kit/sortable 8, Vite 7, Vitest 3, Testing Library, MSW 2, ESLint 9 + Prettier 3.

**Spec:** `docs/superpowers/specs/2026-10-08-task-manager-design.md`

## Global Constraints

- Monorepo: pnpm workspaces `apps/*`, `packages/*`; package names `@tm/shared`, `@tm/api`, `@tm/web`; TypeScript `strict: true` everywhere; ESM (`"type": "module"`) everywhere.
- Pinned majors (do NOT upgrade to newer majors): `typescript@^5.9.3`, `react@^19.3.0`, `react-router@^7.18.4`, `vite@^7.3.7`, `vitest@^3.2.7`, `zod@^4.6.5`, `fastify@^5.12.5`, `drizzle-orm@^0.45.4`, `drizzle-kit@^0.31.11`, `@tanstack/react-query@^5.104.1`, `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^8.0.0`, `msw@^2.15.0`, `jsdom@^26.1.0`, `@vitejs/plugin-react@^5.2.0`, `@testing-library/jest-dom@^6.10.0`.
- DB: local Postgres 17, no Docker. `DATABASE_URL=postgres://localhost:5432/taskmanager`, `DATABASE_URL_TEST=postgres://localhost:5432/taskmanager_test`, `API_PORT=3001`. Web dev server on 5173 proxies `/api` to 3001.
- No authentication. Current user = `X-User-Id` header (uuid); endpoints that need it answer `400 { error: { code: 'user_required' | 'unknown_user' } }` when missing/unknown.
- Error body format: `{ error: { code, message, details? } }`; 400 validation (`validation_error`) / `bad_request`, 404 `not_found`, 409 `conflict`, 500 `internal`.
- Statuses: `backlog | todo | in_progress | in_review | done`. List order: In Progress, In Review, Todo, Backlog, Done. Board order: Backlog, Todo, In Progress, In Review, Done. Priorities: `none | urgent | high | medium | low`.
- Issue key = `${team.key}-${number}`, number from atomic `teams.issue_counter` increment.
- UI copy is English (as in the mockups). Design tokens are the exact hex values listed in spec §5; fonts Geist 400/500/600 and Geist Mono from Google Fonts; base font-size 13px.
- Spec deviation (intentional, simplification): the `views` table has no `team_id` column — the team lives in `filters.teamId`.

## Review Focus

1. Dropping a card onto an empty column or onto a column's free space → the issue moves to that column at the end (pinned by `planMove` tests in Task 9).
2. Clearing optional properties (assignee → "No assignee", removing due date / estimate / project / cycle) → `null` is persisted and activity reads "removed …" (pinned in Task 5 API tests and Task 9 `describeActivity` tests).
3. Malformed or unknown issue keys (`/issue/foo`, `/issue/DEV-99999`, `dev-0`) → API 404 JSON, UI shows "Issue not found" instead of crashing (pinned in Task 4 and Task 14 tests).
4. Concurrent issue creation in one team → unique, gap-free sequential numbers (pinned in Task 4).
5. Switching the current user → Inbox count and My issues show the new user's data, never the previous user's cache (query keys include the user id; pinned in Task 8 and Task 15 tests).

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, .prettierrc, .gitignore, .env.example, README.md
packages/shared/src/
  constants.ts      statuses, priorities, labels, orders, activity types, estimate options
  issueKey.ts       parseIssueKey / formatIssueKey
  schemas.ts        zod request schemas (create/update issue, filters, comment, project, view, inbox read)
  types.ts          DTO interfaces returned by the API
  index.ts          re-exports
apps/api/
  drizzle.config.ts, vitest.config.ts, drizzle/ (generated SQL)
  scripts/          db-setup.ts, migrate.ts, seed.ts (CLI entry points)
  src/config.ts     env loading
  src/errors.ts     HttpError + helpers
  src/current-user.ts  X-User-Id resolution
  src/app.ts        buildApp(): Fastify instance, error handler, route registration
  src/server.ts     listen
  src/db/           schema.ts, client.ts, columns.ts, ensure.ts, migrate.ts, truncate.ts, seed.ts
  src/services/     refs.ts (reference validation), issues.ts, inbox.ts
  src/routes/       users.ts, teams.ts, labels.ts, projects.ts, cycles.ts, issues.ts, inbox.ts, views.ts
  test/             global-setup.ts, helpers.ts, *.test.ts
apps/web/
  index.html, vite.config.ts
  src/main.tsx, src/App.tsx (routes + providers)
  src/styles/       tokens.css, global.css
  src/api/          client.ts (fetch wrapper), queries.ts (query hooks), mutations.ts (mutation hooks)
  src/lib/          cx.ts, storage.ts, format.ts, filters.ts, activityText.ts, applyPatch.ts, boardMove.ts,
                    useDismiss.ts, useDensity.ts, currentUser.tsx, toast.tsx, newIssue.tsx
  src/components/   icons.tsx, primitives.tsx, PropertyPicker.tsx, pickers.tsx, Sidebar.tsx, AppLayout.tsx,
                    PageHeader.tsx, IssueRow.tsx, IssueList.tsx, FilterMenu.tsx, DisplayMenu.tsx, ViewToggle.tsx,
                    NewIssueModal.tsx, IssueCard.tsx, BoardColumn.tsx, states.tsx (+ matching *.module.css)
  src/pages/        IssueListPage, BoardPage, IssuePage, MyIssuesPage, InboxPage, ProjectsPage, ProjectPage,
                    CyclesPage, CyclePage, ViewsPage, ViewPage, NotFound (+ page.module.css and per-page css)
  src/test/         setup.ts, server.ts (MSW in-memory backend), render.tsx
```

---

### Task 1: Monorepo scaffold and `@tm/shared`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.prettierrc`, `eslint.config.js`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/constants.ts`, `issueKey.ts`, `schemas.ts`, `types.ts`, `index.ts`
- Test: `packages/shared/src/issueKey.test.ts`, `packages/shared/src/schemas.test.ts`

**Interfaces:**
- Produces (exported from `@tm/shared`):
  - `ISSUE_STATUSES`, `type IssueStatus`, `ISSUE_PRIORITIES`, `type IssuePriority`, `STATUS_LABELS`, `PRIORITY_LABELS`, `LIST_STATUS_ORDER`, `BOARD_STATUS_ORDER`, `ACTIVE_STATUSES`, `ACTIVITY_TYPES`, `type ActivityType`, `ESTIMATE_OPTIONS`
  - `parseIssueKey(key: string): { teamKey: string; number: number } | null`, `formatIssueKey(teamKey: string, n: number): string`
  - zod: `issueStatusSchema`, `issuePrioritySchema`, `viewFiltersSchema`, `issueFiltersSchema`, `issueCreateSchema`, `issueUpdateSchema`, `commentCreateSchema`, `projectCreateSchema`, `viewCreateSchema`, `viewUpdateSchema`, `inboxReadSchema`, `idParamsSchema`
  - input types: `IssueCreateInput`, `IssueUpdateInput`, `CommentCreateInput`, `ProjectCreateInput`, `ViewCreateInput`, `ViewUpdateInput`, `InboxReadInput`
  - DTOs: `User`, `Team`, `Label`, `Project`, `Cycle`, `ViewFilters`, `IssueFilters`, `IssueListItem`, `IssueDetail`, `CommentDto`, `ActivityEntry`, `InboxItem`, `InboxResponse`, `View`, `ApiErrorBody`

- [ ] **Step 1: Create root workspace files**

`package.json`:
```json
{
  "name": "task-manager",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.25.0",
  "scripts": {
    "dev": "concurrently -n api,web -c blue,magenta \"pnpm --filter @tm/api dev\" \"pnpm --filter @tm/web dev\"",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "lint": "eslint .",
    "format": "prettier --write .",
    "db:setup": "pnpm --filter @tm/api db:setup",
    "db:generate": "pnpm --filter @tm/api db:generate",
    "db:migrate": "pnpm --filter @tm/api db:migrate",
    "db:seed": "pnpm --filter @tm/api db:seed"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.5",
    "concurrently": "^9.2.5",
    "eslint": "^9.39.5",
    "eslint-plugin-react-hooks": "^7.1.1",
    "globals": "^17.13.0",
    "prettier": "^3.9.9",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.71.1"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
onlyBuiltDependencies:
  - esbuild
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

`.gitignore`:
```
node_modules
dist
coverage
.env
*.log
.DS_Store
test-results
playwright-report
```

`.env.example`:
```
DATABASE_URL=postgres://localhost:5432/taskmanager
DATABASE_URL_TEST=postgres://localhost:5432/taskmanager_test
API_PORT=3001
```

`.prettierrc`:
```json
{ "singleQuote": true, "printWidth": 110, "trailingComma": "all" }
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/drizzle/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  { files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.js'], languageOptions: { globals: globals.node } },
);
```

Run: `cp .env.example .env`

- [ ] **Step 2: Create the shared package manifest**

`packages/shared/package.json`:
```json
{
  "name": "@tm/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit", "build": "tsc --noEmit" },
  "dependencies": { "zod": "^4.6.5" },
  "devDependencies": { "typescript": "^5.9.3", "vitest": "^3.2.7" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

Run: `pnpm install`
Expected: lockfile created, no errors. If pnpm prints that build scripts were ignored, run `pnpm approve-builds` and approve `esbuild`.

- [ ] **Step 3: Write failing tests**

`packages/shared/src/issueKey.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatIssueKey, parseIssueKey } from './issueKey';

describe('parseIssueKey', () => {
  it('parses a valid key', () => {
    expect(parseIssueKey('DEV-142')).toEqual({ teamKey: 'DEV', number: 142 });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseIssueKey(' dev-7 ')).toEqual({ teamKey: 'DEV', number: 7 });
  });

  it.each(['', 'DEV', 'DEV-', 'DEV-0', 'DEV-01', '-1', 'DEV-1-2', 'D E-1', 'DEV-1234567890', '1DEV-2'])(
    'rejects %j',
    (key) => {
      expect(parseIssueKey(key)).toBeNull();
    },
  );
});

describe('formatIssueKey', () => {
  it('joins team key and number', () => {
    expect(formatIssueKey('DES', 12)).toBe('DES-12');
  });
});
```

`packages/shared/src/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { inboxReadSchema, issueCreateSchema, issueFiltersSchema, issueUpdateSchema, viewCreateSchema } from './schemas';

const id = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('issueCreateSchema', () => {
  it('accepts minimal input and trims the title', () => {
    expect(issueCreateSchema.parse({ teamId: id, title: '  Fix login  ' })).toEqual({ teamId: id, title: 'Fix login' });
  });

  it('rejects a whitespace-only title', () => {
    expect(issueCreateSchema.safeParse({ teamId: id, title: '   ' }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(issueCreateSchema.safeParse({ teamId: id, title: 'x', status: 'started' }).success).toBe(false);
  });

  it('accepts null for every clearable field', () => {
    const result = issueCreateSchema.safeParse({
      teamId: id,
      title: 'x',
      assigneeId: null,
      projectId: null,
      cycleId: null,
      parentId: null,
      dueDate: null,
      estimate: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed due date', () => {
    expect(issueCreateSchema.safeParse({ teamId: id, title: 'x', dueDate: '17.10.2026' }).success).toBe(false);
  });
});

describe('issueUpdateSchema', () => {
  it('rejects an empty patch', () => {
    expect(issueUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a sortOrder-only patch', () => {
    expect(issueUpdateSchema.parse({ sortOrder: 1500.5 })).toEqual({ sortOrder: 1500.5 });
  });

  it('does not allow moving an issue to another team', () => {
    expect(issueUpdateSchema.safeParse({ teamId: id }).success).toBe(false);
  });
});

describe('issueFiltersSchema', () => {
  it('wraps single query values into arrays', () => {
    expect(issueFiltersSchema.parse({ status: 'todo', labelId: id })).toEqual({ status: ['todo'], labelId: [id] });
  });

  it('keeps repeated query values', () => {
    expect(issueFiltersSchema.parse({ status: ['todo', 'done'] })).toEqual({ status: ['todo', 'done'] });
  });

  it('parses mine=true', () => {
    expect(issueFiltersSchema.parse({ mine: 'true' })).toEqual({ mine: true });
  });

  it('rejects invalid enum values', () => {
    expect(issueFiltersSchema.safeParse({ priority: 'critical' }).success).toBe(false);
  });
});

describe('viewCreateSchema', () => {
  it('defaults filters to an empty object', () => {
    expect(viewCreateSchema.parse({ name: ' Bugs ' })).toEqual({ name: 'Bugs', filters: {} });
  });
});

describe('inboxReadSchema', () => {
  it('accepts a list of ids or all=true', () => {
    expect(inboxReadSchema.safeParse({ activityIds: [id] }).success).toBe(true);
    expect(inboxReadSchema.safeParse({ all: true }).success).toBe(true);
  });

  it('rejects empty input', () => {
    expect(inboxReadSchema.safeParse({}).success).toBe(false);
    expect(inboxReadSchema.safeParse({ all: false }).success).toBe(false);
    expect(inboxReadSchema.safeParse({ activityIds: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm --filter @tm/shared test`
Expected: FAIL — `Cannot find module './issueKey'` / `'./schemas'`.

- [ ] **Step 5: Implement the shared package**

`packages/shared/src/constants.ts`:
```ts
export const ISSUE_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = ['none', 'urgent', 'high', 'medium', 'low'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  none: 'No priority',
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const LIST_STATUS_ORDER: readonly IssueStatus[] = ['in_progress', 'in_review', 'todo', 'backlog', 'done'];
export const BOARD_STATUS_ORDER: readonly IssueStatus[] = ISSUE_STATUSES;
export const ACTIVE_STATUSES: readonly IssueStatus[] = ['in_progress', 'in_review', 'todo'];

export const ACTIVITY_TYPES = [
  'created',
  'status',
  'priority',
  'assignee',
  'title',
  'labels',
  'project',
  'cycle',
  'due_date',
  'estimate',
  'parent',
  'comment',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ESTIMATE_OPTIONS: readonly number[] = [1, 2, 3, 5, 8];
```

`packages/shared/src/issueKey.ts`:
```ts
const ISSUE_KEY_RE = /^([A-Z][A-Z0-9]{0,9})-([1-9]\d{0,8})$/;

export function parseIssueKey(key: string): { teamKey: string; number: number } | null {
  const match = ISSUE_KEY_RE.exec(key.trim().toUpperCase());
  if (!match) return null;
  return { teamKey: match[1], number: Number(match[2]) };
}

export function formatIssueKey(teamKey: string, number: number): string {
  return `${teamKey}-${number}`;
}
```

`packages/shared/src/schemas.ts`:
```ts
import { z } from 'zod';
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from './constants';

const id = z.uuid();
const isoDate = z.iso.date();

const toArray = (value: unknown) =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value : [value];
const many = <T extends z.ZodType>(item: T) => z.preprocess(toArray, z.array(item).optional());

export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const issuePrioritySchema = z.enum(ISSUE_PRIORITIES);

export const idParamsSchema = z.object({ id });

export const viewFiltersSchema = z.object({
  teamId: id.optional(),
  status: many(issueStatusSchema),
  priority: many(issuePrioritySchema),
  assigneeId: many(id),
  labelId: many(id),
  projectId: id.optional(),
  cycleId: id.optional(),
});

export const issueFiltersSchema = viewFiltersSchema.extend({
  parentId: id.optional(),
  mine: z.preprocess((value) => value === true || value === 'true', z.boolean()).optional(),
});

const title = z.string().trim().min(1, 'Title is required').max(500);

export const issueCreateSchema = z.object({
  teamId: id,
  title,
  description: z.string().max(100_000).optional(),
  status: issueStatusSchema.optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: id.nullable().optional(),
  labelIds: z.array(id).max(50).optional(),
  projectId: id.nullable().optional(),
  cycleId: id.nullable().optional(),
  parentId: id.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
});

export const issueUpdateSchema = issueCreateSchema
  .omit({ teamId: true })
  .partial()
  .extend({ sortOrder: z.number().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const commentCreateSchema = z.object({ body: z.string().trim().min(1).max(20_000) });

export const projectCreateSchema = z.object({ teamId: id, name: z.string().trim().min(1).max(200) });

const viewName = z.string().trim().min(1).max(100);

export const viewCreateSchema = z.object({ name: viewName, filters: viewFiltersSchema.default({}) });

export const viewUpdateSchema = z
  .object({ name: viewName.optional(), filters: viewFiltersSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const inboxReadSchema = z.union([
  z.object({ activityIds: z.array(id).min(1).max(500) }),
  z.object({ all: z.literal(true) }),
]);

export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ViewCreateInput = z.input<typeof viewCreateSchema>;
export type ViewUpdateInput = z.input<typeof viewUpdateSchema>;
export type InboxReadInput = z.infer<typeof inboxReadSchema>;
```

`packages/shared/src/types.ts`:
```ts
import type { ActivityType, IssuePriority, IssueStatus } from './constants';

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  key: string;
  color: string;
}

export interface Label {
  id: string;
  teamId: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
  issueCount: number;
  doneCount: number;
}

export interface Cycle {
  id: string;
  teamId: string;
  number: number;
  startsOn: string;
  endsOn: string;
  issueCount: number;
  doneCount: number;
}

export interface ViewFilters {
  teamId?: string;
  status?: IssueStatus[];
  priority?: IssuePriority[];
  assigneeId?: string[];
  labelId?: string[];
  projectId?: string;
  cycleId?: string;
}

export interface IssueFilters extends ViewFilters {
  parentId?: string;
  mine?: boolean;
}

export interface IssueListItem {
  id: string;
  key: string;
  teamId: string;
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: User | null;
  labels: Label[];
  projectId: string | null;
  cycleId: string | null;
  parentId: string | null;
  dueDate: string | null;
  estimate: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDto {
  id: string;
  issueId: string;
  author: User;
  body: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  issueId: string;
  actor: User;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface IssueDetail extends IssueListItem {
  description: string;
  creator: User;
  project: { id: string; name: string } | null;
  cycle: { id: string; number: number; startsOn: string; endsOn: string } | null;
  parent: { id: string; key: string; title: string; status: IssueStatus } | null;
  children: IssueListItem[];
  comments: CommentDto[];
  activity: ActivityEntry[];
}

export interface InboxItem {
  read: boolean;
  activity: ActivityEntry;
  issue: { id: string; key: string; title: string; status: IssueStatus };
}

export interface InboxResponse {
  items: InboxItem[];
  unreadCount: number;
}

export interface View {
  id: string;
  name: string;
  filters: ViewFilters;
  createdAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
```

`packages/shared/src/index.ts`:
```ts
export * from './constants';
export * from './issueKey';
export * from './schemas';
export * from './types';
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm --filter @tm/shared test && pnpm --filter @tm/shared typecheck`
Expected: all tests PASS, typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore .env.example .prettierrc eslint.config.js packages/shared
git commit -m "feat(shared): monorepo scaffold with shared schemas, constants and DTO types"
```

---

### Task 2: API database layer (schema, migrations, db:setup, test harness)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/drizzle.config.ts`
- Create: `apps/api/src/config.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/src/db/ensure.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/truncate.ts`
- Create: `apps/api/scripts/db-setup.ts`, `apps/api/scripts/migrate.ts`
- Create: `apps/api/test/global-setup.ts`, `apps/api/test/helpers.ts`
- Generated: `apps/api/drizzle/0000_init.sql` (+ `drizzle/meta/*`)
- Test: `apps/api/test/db.test.ts`

**Interfaces:**
- Consumes: `ISSUE_STATUSES`, `ISSUE_PRIORITIES`, `ActivityType`, `ViewFilters` from `@tm/shared`.
- Produces:
  - `env: { databaseUrl: string; testDatabaseUrl: string; port: number }` (`src/config.ts`)
  - Drizzle tables `users, teams, projects, cycles, labels, issues, issueLabels, comments, activity, inboxReads, views` and enums `issueStatus, issuePriority` (`src/db/schema.ts`)
  - `createDb(url): { db: Db; pool: pg.Pool }`, `type Db`, `type DbOrTx` (`src/db/client.ts`) — every service takes `DbOrTx`
  - `ensureDatabase(url): Promise<void>`, `runMigrations(url): Promise<void>`, `truncateAll(db: DbOrTx): Promise<void>`
  - test helpers: `openTestDb()`, `resetDb(db)`, `seedFixture(db): Promise<Fixture>`, `insertIssue(db, values)`

- [ ] **Step 1: Create the API package manifest and configs**

`apps/api/package.json`:
```json
{
  "name": "@tm/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:setup": "tsx scripts/db-setup.ts"
  },
  "dependencies": {
    "@tm/shared": "workspace:*",
    "dotenv": "^16.6.1",
    "drizzle-orm": "^0.45.4",
    "fastify": "^5.12.5",
    "pg": "^8.23.1",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/pg": "^8.23.1",
    "drizzle-kit": "^0.31.11",
    "tsx": "^4.23.15",
    "typescript": "^5.9.3",
    "vitest": "^3.2.7"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "scripts", "test", "drizzle.config.ts", "vitest.config.ts"]
}
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
```

`apps/api/src/config.ts`:
```ts
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/taskmanager',
  testDatabaseUrl: process.env.DATABASE_URL_TEST ?? 'postgres://localhost:5432/taskmanager_test',
  port: Number(process.env.API_PORT ?? 3001),
};
```

`apps/api/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';
import { env } from './src/config';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: env.databaseUrl },
});
```

Run: `pnpm install`
Expected: installs without errors.

- [ ] **Step 2: Write the failing test and the test harness**

`apps/api/test/global-setup.ts`:
```ts
import { env } from '../src/config';
import { ensureDatabase } from '../src/db/ensure';
import { runMigrations } from '../src/db/migrate';

export default async function setup() {
  await ensureDatabase(env.testDatabaseUrl);
  await runMigrations(env.testDatabaseUrl);
}
```

`apps/api/test/helpers.ts`:
```ts
import { env } from '../src/config';
import { createDb, type DbOrTx } from '../src/db/client';
import * as s from '../src/db/schema';
import { truncateAll } from '../src/db/truncate';

export function openTestDb() {
  return createDb(env.testDatabaseUrl);
}

export async function resetDb(db: DbOrTx) {
  await truncateAll(db);
}

export async function seedFixture(db: DbOrTx) {
  const [alice, bob] = await db
    .insert(s.users)
    .values([
      { name: 'Alice Doe', initials: 'AD', color: '#6D4FC2' },
      { name: 'Bob Roe', initials: 'BR', color: '#2F7D6D' },
    ])
    .returning();
  const [dev, des] = await db
    .insert(s.teams)
    .values([
      { name: 'Engineering', key: 'DEV', color: '#2F7D6D' },
      { name: 'Design', key: 'DES', color: '#B5582F' },
    ])
    .returning();
  const [bug, feat] = await db
    .insert(s.labels)
    .values([
      { teamId: dev.id, name: 'Bug', color: '#EB5757' },
      { teamId: dev.id, name: 'Feature', color: '#A78BFA' },
    ])
    .returning();
  const [brand] = await db.insert(s.labels).values({ teamId: des.id, name: 'Brand', color: '#F07CB4' }).returning();
  const [project] = await db.insert(s.projects).values({ teamId: dev.id, name: 'Mobile app 2.0' }).returning();
  const [cycle] = await db
    .insert(s.cycles)
    .values({ teamId: dev.id, number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' })
    .returning();
  return { alice, bob, dev, des, bug, feat, brand, project, cycle };
}

export type Fixture = Awaited<ReturnType<typeof seedFixture>>;

let counter = 0;

export async function insertIssue(
  db: DbOrTx,
  values: Partial<typeof s.issues.$inferInsert> & { teamId: string; creatorId: string },
) {
  counter += 1;
  const [row] = await db
    .insert(s.issues)
    .values({ number: 10_000 + counter, title: `Issue ${counter}`, sortOrder: counter * 1000, ...values })
    .returning();
  return row;
}
```

`apps/api/test/db.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as s from '../src/db/schema';
import { openTestDb, resetDb, seedFixture } from './helpers';

const { db, pool } = openTestDb();

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetDb(db);
});

describe('database schema', () => {
  it('creates teams with a zero issue counter', async () => {
    const fx = await seedFixture(db);
    expect(fx.dev.key).toBe('DEV');
    expect(fx.dev.issueCounter).toBe(0);
  });

  it('enforces unique team keys', async () => {
    await seedFixture(db);
    await expect(db.insert(s.teams).values({ name: 'Dup', key: 'DEV', color: '#000000' }).execute()).rejects.toThrow();
  });

  it('enforces unique issue numbers per team', async () => {
    const fx = await seedFixture(db);
    const row = { teamId: fx.dev.id, number: 1, title: 'A', creatorId: fx.alice.id, sortOrder: 1000 };
    await db.insert(s.issues).values(row).execute();
    await expect(db.insert(s.issues).values(row).execute()).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @tm/api test`
Expected: FAIL — cannot resolve `../src/db/ensure` / `../src/db/schema`.

- [ ] **Step 4: Implement schema, client and DB utilities**

`apps/api/src/db/schema.ts`:
```ts
import { ISSUE_PRIORITIES, ISSUE_STATUSES, type ActivityType, type ViewFilters } from '@tm/shared';
import {
  type AnyPgColumn,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const issueStatus = pgEnum('issue_status', ISSUE_STATUSES);
export const issuePriority = pgEnum('issue_priority', ISSUE_PRIORITIES);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
});

export const teams = pgTable('teams', {
  id: id(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  color: text('color').notNull(),
  issueCounter: integer('issue_counter').notNull().default(0),
});

export const projects = pgTable('projects', {
  id: id(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const cycles = pgTable(
  'cycles',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
  },
  (t) => [unique('cycles_team_number').on(t.teamId, t.number)],
);

export const labels = pgTable('labels', {
  id: id(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
});

export const issues = pgTable(
  'issues',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: issueStatus('status').notNull().default('todo'),
    priority: issuePriority('priority').notNull().default('none'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => issues.id, { onDelete: 'set null' }),
    dueDate: date('due_date', { mode: 'string' }),
    estimate: integer('estimate'),
    sortOrder: doublePrecision('sort_order').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('issues_team_number').on(t.teamId, t.number),
    index('issues_team_status_sort').on(t.teamId, t.status, t.sortOrder),
    index('issues_parent').on(t.parentId),
  ],
);

export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);

export const comments = pgTable(
  'comments',
  {
    id: id(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('comments_issue').on(t.issueId, t.createdAt)],
);

export const activity = pgTable(
  'activity',
  {
    id: id(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    type: text('type').$type<ActivityType>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('activity_issue').on(t.issueId, t.createdAt)],
);

export const inboxReads = pgTable(
  'inbox_reads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activity.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.activityId] })],
);

export const views = pgTable('views', {
  id: id(),
  name: text('name').notNull(),
  filters: jsonb('filters').$type<ViewFilters>().notNull().default({}),
  createdAt: createdAt(),
});
```

`apps/api/src/db/client.ts`:
```ts
import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema';

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];
/** Accepts both the root database and a transaction handle. */
export type DbOrTx = PgDatabase<NodePgQueryResultHKT, typeof schema>;
```

`apps/api/src/db/ensure.ts`:
```ts
import pg from 'pg';

export async function ensureDatabase(url: string): Promise<void> {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (existing.rowCount === 0) {
      await client.query(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}
```

`apps/api/src/db/migrate.ts`:
```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { createDb } from './client';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(url: string): Promise<void> {
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
```

`apps/api/src/db/truncate.ts`:
```ts
import { sql } from 'drizzle-orm';
import type { DbOrTx } from './client';

export async function truncateAll(db: DbOrTx): Promise<void> {
  await db.execute(
    sql`truncate table inbox_reads, activity, comments, issue_labels, issues, labels, cycles, projects, views, teams, users restart identity cascade`,
  );
}
```

`apps/api/scripts/migrate.ts`:
```ts
import { env } from '../src/config';
import { runMigrations } from '../src/db/migrate';

await runMigrations(env.databaseUrl);
console.log('✓ migrations applied');
```

`apps/api/scripts/db-setup.ts`:
```ts
import { env } from '../src/config';
import { ensureDatabase } from '../src/db/ensure';
import { runMigrations } from '../src/db/migrate';

for (const url of [env.databaseUrl, env.testDatabaseUrl]) {
  await ensureDatabase(url);
  await runMigrations(url);
  console.log(`✓ ${new URL(url).pathname.slice(1)} is ready`);
}
```

- [ ] **Step 5: Generate the initial migration**

Run: `pnpm --filter @tm/api db:generate --name init`
Expected: `apps/api/drizzle/0000_init.sql` is created and contains `CREATE TYPE "public"."issue_status"`, `CREATE TABLE "issues"`, `"issues_team_number" UNIQUE`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @tm/api test && pnpm --filter @tm/api typecheck`
Expected: global setup creates `taskmanager_test`, 3 tests PASS, typecheck exits 0.

Run: `pnpm db:setup`
Expected: prints `✓ taskmanager is ready` and `✓ taskmanager_test is ready`.

- [ ] **Step 7: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): drizzle schema, migrations, db setup and test harness"
```

---

### Task 3: Fastify app skeleton and reference endpoints

**Files:**
- Create: `apps/api/src/errors.ts`, `apps/api/src/current-user.ts`, `apps/api/src/db/columns.ts`, `apps/api/src/services/refs.ts`
- Create: `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Create: `apps/api/src/routes/users.ts`, `teams.ts`, `labels.ts`, `projects.ts`, `cycles.ts`
- Modify: `apps/api/test/helpers.ts` (add `createTestApp`, `as`)
- Test: `apps/api/test/reference.test.ts`

**Interfaces:**
- Consumes: `createDb`, `DbOrTx`, tables (Task 2); `idParamsSchema`, `projectCreateSchema`, DTO types (Task 1).
- Produces:
  - `class HttpError(status, code, message)`, `badRequest(msg)`, `notFound(what)`, `conflict(msg)` (`src/errors.ts`)
  - `requireUserId(app: FastifyInstance, req: FastifyRequest): Promise<string>` (`src/current-user.ts`)
  - `userColumns` select shape (`src/db/columns.ts`)
  - `assertTeamExists(db, teamId)` (`src/services/refs.ts`; Task 4 adds `validateRefs` to the same file)
  - `buildApp({ db, logger? }): Promise<FastifyInstance>`; `app.db` decorator; routes registered under `/api`
  - test helpers `createTestApp(): Promise<{ app, db, close }>`, `as(user): { 'x-user-id': string }`

- [ ] **Step 1: Extend the test helpers**

Append to `apps/api/test/helpers.ts`:
```ts
import { buildApp } from '../src/app';

export async function createTestApp() {
  const { db, pool } = openTestDb();
  const app = await buildApp({ db });
  await app.ready();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestApp>>;

export function as(user: { id: string }) {
  return { 'x-user-id': user.id };
}
```
(Move the new `import { buildApp } ...` line to the top of the file with the other imports.)

- [ ] **Step 2: Write the failing tests**

`apps/api/test/reference.test.ts`:
```ts
import type { Cycle, Label, Project, Team, User } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, insertIssue, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
});

const get = (url: string) => ctx.app.inject({ method: 'GET', url });

describe('reference endpoints', () => {
  it('lists users sorted by name', async () => {
    const res = await get('/api/users');
    expect(res.statusCode).toBe(200);
    expect((res.json() as User[]).map((u) => u.name)).toEqual(['Alice Doe', 'Bob Roe']);
  });

  it('lists teams with keys and colors', async () => {
    const teams = (await get('/api/teams')).json() as Team[];
    expect(teams).toEqual([
      { id: fx.des.id, name: 'Design', key: 'DES', color: '#B5582F' },
      { id: fx.dev.id, name: 'Engineering', key: 'DEV', color: '#2F7D6D' },
    ]);
  });

  it('filters labels by team', async () => {
    const labels = (await get(`/api/labels?teamId=${fx.dev.id}`)).json() as Label[];
    expect(labels.map((l) => l.name)).toEqual(['Bug', 'Feature']);
    expect(((await get('/api/labels')).json() as Label[]).length).toBe(3);
  });

  it('returns a validation error for a malformed teamId', async () => {
    const res = await get('/api/labels?teamId=nope');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
  });

  it('lists projects with issue progress', async () => {
    await insertIssue(ctx.db, { teamId: fx.dev.id, creatorId: fx.alice.id, projectId: fx.project.id, status: 'done' });
    await insertIssue(ctx.db, { teamId: fx.dev.id, creatorId: fx.alice.id, projectId: fx.project.id });
    const [project] = (await get(`/api/projects?teamId=${fx.dev.id}`)).json() as Project[];
    expect(project).toMatchObject({ name: 'Mobile app 2.0', issueCount: 2, doneCount: 1 });
    expect((await get(`/api/projects/${fx.project.id}`)).json()).toMatchObject({ id: fx.project.id });
  });

  it('creates a project', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { teamId: fx.des.id, name: '  Brand refresh ' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Brand refresh', teamId: fx.des.id, issueCount: 0, doneCount: 0 });
  });

  it('rejects a project for an unknown team', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { teamId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', name: 'X' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_request');
  });

  it('returns 404 for an unknown project', async () => {
    const res = await get('/api/projects/6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Project not found' } });
  });

  it('lists cycles with progress', async () => {
    await insertIssue(ctx.db, { teamId: fx.dev.id, creatorId: fx.alice.id, cycleId: fx.cycle.id, status: 'done' });
    const [cycle] = (await get(`/api/cycles?teamId=${fx.dev.id}`)).json() as Cycle[];
    expect(cycle).toEqual({
      id: fx.cycle.id,
      teamId: fx.dev.id,
      number: 14,
      startsOn: '2026-10-06',
      endsOn: '2026-10-19',
      issueCount: 1,
      doneCount: 1,
    });
    expect((await get(`/api/cycles/${fx.cycle.id}`)).json()).toMatchObject({ number: 14 });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await get('/api/nothing-here');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @tm/api test reference`
Expected: FAIL — cannot resolve `../src/app`.

- [ ] **Step 4: Implement errors, current user, columns and refs**

`apps/api/src/errors.ts`:
```ts
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);
export const conflict = (message: string) => new HttpError(409, 'conflict', message);
```

`apps/api/src/db/columns.ts`:
```ts
import { users } from './schema';

export const userColumns = { id: users.id, name: users.name, initials: users.initials, color: users.color };
```

`apps/api/src/current-user.ts`:
```ts
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
```

`apps/api/src/services/refs.ts`:
```ts
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { teams } from '../db/schema';
import { badRequest } from '../errors';

export async function assertTeamExists(db: DbOrTx, teamId: string): Promise<void> {
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId));
  if (!team) throw badRequest('Unknown team');
}
```

- [ ] **Step 5: Implement the reference routes**

`apps/api/src/routes/users.ts`:
```ts
import type { User } from '@tm/shared';
import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { userColumns } from '../db/columns';
import { users } from '../db/schema';

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', async (): Promise<User[]> => app.db.select(userColumns).from(users).orderBy(asc(users.name)));
}
```

`apps/api/src/routes/teams.ts`:
```ts
import type { Team } from '@tm/shared';
import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { teams } from '../db/schema';

export async function teamRoutes(app: FastifyInstance) {
  app.get(
    '/teams',
    async (): Promise<Team[]> =>
      app.db
        .select({ id: teams.id, name: teams.name, key: teams.key, color: teams.color })
        .from(teams)
        .orderBy(asc(teams.name)),
  );
}
```

`apps/api/src/routes/labels.ts`:
```ts
import type { Label } from '@tm/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { labels } from '../db/schema';

const querySchema = z.object({ teamId: z.uuid().optional() });

export async function labelRoutes(app: FastifyInstance) {
  app.get('/labels', async (req): Promise<Label[]> => {
    const { teamId } = querySchema.parse(req.query);
    return app.db
      .select({ id: labels.id, teamId: labels.teamId, name: labels.name, color: labels.color })
      .from(labels)
      .where(teamId ? eq(labels.teamId, teamId) : undefined)
      .orderBy(asc(labels.name));
  });
}
```

`apps/api/src/routes/projects.ts`:
```ts
import { idParamsSchema, projectCreateSchema, type Project } from '@tm/shared';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbOrTx } from '../db/client';
import { issues, projects } from '../db/schema';
import { notFound } from '../errors';
import { assertTeamExists } from '../services/refs';

const querySchema = z.object({ teamId: z.uuid().optional() });

async function queryProjects(db: DbOrTx, where?: SQL): Promise<Project[]> {
  const rows = await db
    .select({
      id: projects.id,
      teamId: projects.teamId,
      name: projects.name,
      createdAt: projects.createdAt,
      issueCount: sql<number>`count(${issues.id})::int`,
      doneCount: sql<number>`(count(${issues.id}) filter (where ${issues.status} = 'done'))::int`,
    })
    .from(projects)
    .leftJoin(issues, eq(issues.projectId, projects.id))
    .where(where)
    .groupBy(projects.id)
    .orderBy(asc(projects.name));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', async (req) => {
    const { teamId } = querySchema.parse(req.query);
    return queryProjects(app.db, teamId ? eq(projects.teamId, teamId) : undefined);
  });

  app.get('/projects/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const [project] = await queryProjects(app.db, eq(projects.id, id));
    if (!project) throw notFound('Project');
    return project;
  });

  app.post('/projects', async (req, reply) => {
    const input = projectCreateSchema.parse(req.body);
    await assertTeamExists(app.db, input.teamId);
    const [row] = await app.db.insert(projects).values(input).returning({ id: projects.id });
    const [project] = await queryProjects(app.db, eq(projects.id, row.id));
    return reply.status(201).send(project);
  });
}
```

`apps/api/src/routes/cycles.ts`:
```ts
import { idParamsSchema, type Cycle } from '@tm/shared';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbOrTx } from '../db/client';
import { cycles, issues } from '../db/schema';
import { notFound } from '../errors';

const querySchema = z.object({ teamId: z.uuid().optional() });

async function queryCycles(db: DbOrTx, where?: SQL): Promise<Cycle[]> {
  return db
    .select({
      id: cycles.id,
      teamId: cycles.teamId,
      number: cycles.number,
      startsOn: cycles.startsOn,
      endsOn: cycles.endsOn,
      issueCount: sql<number>`count(${issues.id})::int`,
      doneCount: sql<number>`(count(${issues.id}) filter (where ${issues.status} = 'done'))::int`,
    })
    .from(cycles)
    .leftJoin(issues, eq(issues.cycleId, cycles.id))
    .where(where)
    .groupBy(cycles.id)
    .orderBy(asc(cycles.number));
}

export async function cycleRoutes(app: FastifyInstance) {
  app.get('/cycles', async (req) => {
    const { teamId } = querySchema.parse(req.query);
    return queryCycles(app.db, teamId ? eq(cycles.teamId, teamId) : undefined);
  });

  app.get('/cycles/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const [cycle] = await queryCycles(app.db, eq(cycles.id, id));
    if (!cycle) throw notFound('Cycle');
    return cycle;
  });
}
```

- [ ] **Step 6: Implement the app and server**

`apps/api/src/app.ts`:
```ts
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
    const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (status < 500) {
      return reply.status(status).send({ error: { code: 'bad_request', message: err.message } });
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
```

`apps/api/src/server.ts`:
```ts
import { buildApp } from './app';
import { env } from './config';
import { createDb } from './db/client';

const { db } = createDb(env.databaseUrl);
const app = await buildApp({ db, logger: true });
await app.listen({ port: env.port, host: '127.0.0.1' });
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @tm/api test && pnpm --filter @tm/api typecheck`
Expected: all tests PASS (db + reference), typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/api
git commit -m "feat(api): fastify app, error handling and reference endpoints"
```

---
### Task 4: Issues — create, list with filters, detail by key

**Files:**
- Modify: `apps/api/src/services/refs.ts` (add `validateRefs`)
- Create: `apps/api/src/services/issues.ts`
- Create: `apps/api/src/routes/issues.ts`
- Modify: `apps/api/src/app.ts` (register `issueRoutes`)
- Modify: `apps/api/test/helpers.ts` (add `createIssueVia`)
- Test: `apps/api/test/issues-create.test.ts`, `apps/api/test/issues-read.test.ts`

**Interfaces:**
- Consumes: tables, `DbOrTx`, `userColumns`, `requireUserId`, errors, `assertTeamExists`; `issueCreateSchema`, `issueFiltersSchema`, `parseIssueKey`, `formatIssueKey`, DTO types.
- Produces (`src/services/issues.ts`):
  - `listIssues(db: DbOrTx, filters: IssueFilters, userId: string | null): Promise<IssueListItem[]>`
  - `getIssueByKey(db: DbOrTx, key: string): Promise<IssueDetail>`
  - `getIssueById(db: DbOrTx, id: string): Promise<IssueDetail>`
  - `createIssue(db: DbOrTx, input: IssueCreateInput, actorId: string): Promise<IssueDetail>`
  - `nextSortOrder(db: DbOrTx, teamId: string, status: IssueStatus): Promise<number>` (used by Task 5)
  - `validateRefs(db, teamId, refs, selfId: string | null): Promise<void>` (`src/services/refs.ts`)
- HTTP: `GET /api/issues`, `GET /api/issues/:key`, `POST /api/issues` (201)
- Test helper: `createIssueVia(ctx, user, body): Promise<IssueDetail>`

- [ ] **Step 1: Add the test helper**

Append to `apps/api/test/helpers.ts` (add `import type { IssueDetail } from '@tm/shared';` at the top):
```ts
export async function createIssueVia(
  ctx: TestContext,
  user: { id: string },
  body: Record<string, unknown>,
): Promise<IssueDetail> {
  const res = await ctx.app.inject({ method: 'POST', url: '/api/issues', headers: as(user), payload: body });
  if (res.statusCode !== 201) throw new Error(`create failed: ${res.statusCode} ${res.body}`);
  return res.json() as IssueDetail;
}
```

- [ ] **Step 2: Write the failing creation tests**

`apps/api/test/issues-create.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
});

const post = (body: Record<string, unknown>, headers: Record<string, string> = as(fx.alice)) =>
  ctx.app.inject({ method: 'POST', url: '/api/issues', headers, payload: body });

describe('POST /api/issues', () => {
  it('assigns sequential numbers per team', async () => {
    const a = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'One' });
    const b = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Two' });
    const c = await createIssueVia(ctx, fx.alice, { teamId: fx.des.id, title: 'Three' });
    expect([a.key, b.key, c.key]).toEqual(['DEV-1', 'DEV-2', 'DES-1']);
  });

  it('never duplicates numbers under concurrent creation', async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: `C${i}` })),
    );
    expect(created.map((i) => i.number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('applies defaults and records a created activity', async () => {
    const issue = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Defaults' });
    expect(issue).toMatchObject({
      status: 'todo',
      priority: 'none',
      description: '',
      assignee: null,
      labels: [],
      sortOrder: 1000,
      creator: { id: fx.alice.id, name: 'Alice Doe' },
    });
    expect(issue.activity.map((a) => a.type)).toEqual(['created']);
  });

  it('places new issues at the bottom of their status column', async () => {
    await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'First' });
    const second = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Second' });
    const backlog = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'B', status: 'backlog' });
    expect(second.sortOrder).toBe(2000);
    expect(backlog.sortOrder).toBe(1000);
  });

  it('stores labels and references', async () => {
    const issue = await createIssueVia(ctx, fx.alice, {
      teamId: fx.dev.id,
      title: 'Full',
      priority: 'high',
      assigneeId: fx.bob.id,
      labelIds: [fx.feat.id, fx.bug.id],
      projectId: fx.project.id,
      cycleId: fx.cycle.id,
      dueDate: '2026-10-17',
      estimate: 5,
    });
    expect(issue.labels.map((l) => l.name)).toEqual(['Bug', 'Feature']);
    expect(issue.assignee).toEqual({ id: fx.bob.id, name: 'Bob Roe', initials: 'BR', color: '#2F7D6D' });
    expect(issue.project).toEqual({ id: fx.project.id, name: 'Mobile app 2.0' });
    expect(issue.cycle).toMatchObject({ number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' });
    expect(issue).toMatchObject({ dueDate: '2026-10-17', estimate: 5, priority: 'high' });
  });

  it('requires a current user', async () => {
    const res = await post({ teamId: fx.dev.id, title: 'x' }, {});
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('user_required');
  });

  it('rejects an unknown current user', async () => {
    const res = await post({ teamId: fx.dev.id, title: 'x' }, { 'x-user-id': '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('unknown_user');
  });

  it('rejects blank titles', async () => {
    const res = await post({ teamId: fx.dev.id, title: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
  });

  it('rejects an unknown team', async () => {
    const res = await post({ teamId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', title: 'x' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Unknown team');
  });

  it('rejects labels of another team', async () => {
    const res = await post({ teamId: fx.dev.id, title: 'x', labelIds: [fx.brand.id] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_request');
  });

  it('rejects a parent from another team with 409', async () => {
    const parent = await createIssueVia(ctx, fx.alice, { teamId: fx.des.id, title: 'Design parent' });
    const res = await post({ teamId: fx.dev.id, title: 'Child', parentId: parent.id });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('conflict');
  });
});
```

- [ ] **Step 3: Write the failing read tests**

`apps/api/test/issues-read.test.ts`:
```ts
import type { IssueDetail, IssueListItem } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;
let crash: IssueDetail;
let offline: IssueDetail;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
  crash = await createIssueVia(ctx, fx.alice, {
    teamId: fx.dev.id,
    title: 'Crash',
    status: 'in_progress',
    priority: 'urgent',
    assigneeId: fx.alice.id,
    labelIds: [fx.bug.id],
    projectId: fx.project.id,
    cycleId: fx.cycle.id,
  });
  offline = await createIssueVia(ctx, fx.alice, {
    teamId: fx.dev.id,
    title: 'Offline',
    priority: 'high',
    assigneeId: fx.bob.id,
    labelIds: [fx.feat.id],
  });
  await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Docs', status: 'backlog' });
  await createIssueVia(ctx, fx.alice, { teamId: fx.des.id, title: 'Icons' });
});

const list = async (query: string, headers: Record<string, string> = {}) => {
  const res = await ctx.app.inject({ method: 'GET', url: `/api/issues${query}`, headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as IssueListItem[]).map((i) => i.title);
};

describe('GET /api/issues', () => {
  it('filters by team', async () => {
    expect(await list(`?teamId=${fx.dev.id}`)).toHaveLength(3);
  });

  it('filters by multiple statuses', async () => {
    expect((await list(`?teamId=${fx.dev.id}&status=todo&status=backlog`)).sort()).toEqual(['Docs', 'Offline']);
  });

  it('filters by priority, assignee, label, project and cycle', async () => {
    expect(await list('?priority=urgent')).toEqual(['Crash']);
    expect(await list(`?assigneeId=${fx.bob.id}`)).toEqual(['Offline']);
    expect(await list(`?labelId=${fx.feat.id}`)).toEqual(['Offline']);
    expect(await list(`?projectId=${fx.project.id}`)).toEqual(['Crash']);
    expect(await list(`?cycleId=${fx.cycle.id}`)).toEqual(['Crash']);
  });

  it('filters mine using the current user', async () => {
    expect(await list('?mine=true', as(fx.bob))).toEqual(['Offline']);
  });

  it('requires a current user for mine=true', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/issues?mine=true' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('user_required');
  });

  it('orders issues by sortOrder within the result', async () => {
    await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Later' });
    expect(await list(`?teamId=${fx.dev.id}&status=todo`)).toEqual(['Offline', 'Later']);
  });

  it('returns list items with key, labels and assignee', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/issues?priority=urgent` });
    const [item] = res.json() as IssueListItem[];
    expect(item).toMatchObject({
      key: 'DEV-1',
      status: 'in_progress',
      assignee: { id: fx.alice.id },
      labels: [{ name: 'Bug', color: '#EB5757' }],
    });
    expect(typeof item.createdAt).toBe('string');
  });

  it('rejects invalid filter values', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/issues?status=nope' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/issues/:key', () => {
  it('returns details with parent and children', async () => {
    const child = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Child', parentId: offline.id });
    const parent = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${offline.key}` })).json() as IssueDetail;
    expect(parent.children.map((c) => c.key)).toEqual([child.key]);
    const fetched = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${child.key}` })).json() as IssueDetail;
    expect(fetched.parent).toEqual({ id: offline.id, key: offline.key, title: 'Offline', status: 'todo' });
  });

  it('accepts lowercase keys', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/issues/${crash.key.toLowerCase()}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(crash.id);
  });

  it.each(['DEV-999', 'garbage', 'dev-0', 'XYZ-1'])('returns 404 for %s', async (key) => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/issues/${key}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Issue not found' } });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm --filter @tm/api test issues`
Expected: FAIL — `POST /api/issues` returns 404 (`create failed: 404`).

- [ ] **Step 5: Add reference validation**

Append to `apps/api/src/services/refs.ts` (extend the imports to `import { and, eq, inArray } from 'drizzle-orm';`, `import { cycles, issues, labels, projects, teams, users } from '../db/schema';`, `import { badRequest, conflict } from '../errors';`):
```ts
export interface RefInput {
  assigneeId?: string | null;
  labelIds?: string[];
  projectId?: string | null;
  cycleId?: string | null;
  parentId?: string | null;
}

export async function validateRefs(
  db: DbOrTx,
  teamId: string,
  input: RefInput,
  selfId: string | null,
): Promise<void> {
  if (input.assigneeId) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.assigneeId));
    if (!user) throw badRequest('Unknown assignee');
  }
  if (input.labelIds?.length) {
    const unique = [...new Set(input.labelIds)];
    const found = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(inArray(labels.id, unique), eq(labels.teamId, teamId)));
    if (found.length !== unique.length) throw badRequest('Unknown label for this team');
  }
  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.teamId, teamId)));
    if (!project) throw badRequest('Unknown project for this team');
  }
  if (input.cycleId) {
    const [cycle] = await db
      .select({ id: cycles.id })
      .from(cycles)
      .where(and(eq(cycles.id, input.cycleId), eq(cycles.teamId, teamId)));
    if (!cycle) throw badRequest('Unknown cycle for this team');
  }
  if (input.parentId) {
    if (input.parentId === selfId) throw conflict('An issue cannot be its own parent');
    const [parent] = await db.select({ teamId: issues.teamId }).from(issues).where(eq(issues.id, input.parentId));
    if (!parent) throw badRequest('Unknown parent issue');
    if (parent.teamId !== teamId) throw conflict('Parent issue must belong to the same team');
    if (selfId) {
      const seen = new Set<string>();
      let cursor: string | null = input.parentId;
      while (cursor && !seen.has(cursor)) {
        if (cursor === selfId) throw conflict('Circular parent relationship');
        seen.add(cursor);
        const [row] = await db.select({ parentId: issues.parentId }).from(issues).where(eq(issues.id, cursor));
        cursor = row?.parentId ?? null;
      }
    }
  }
}
```

- [ ] **Step 6: Implement the issues service (read + create)**

`apps/api/src/services/issues.ts`:
```ts
import {
  formatIssueKey,
  parseIssueKey,
  type IssueCreateInput,
  type IssueDetail,
  type IssueFilters,
  type IssueListItem,
  type IssueStatus,
  type Label,
} from '@tm/shared';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { userColumns } from '../db/columns';
import { activity, comments, cycles, issueLabels, issues, labels, projects, teams, users } from '../db/schema';
import { HttpError, badRequest, notFound } from '../errors';
import { validateRefs } from './refs';

const listColumns = {
  id: issues.id,
  teamId: issues.teamId,
  teamKey: teams.key,
  number: issues.number,
  title: issues.title,
  status: issues.status,
  priority: issues.priority,
  projectId: issues.projectId,
  cycleId: issues.cycleId,
  parentId: issues.parentId,
  dueDate: issues.dueDate,
  estimate: issues.estimate,
  sortOrder: issues.sortOrder,
  createdAt: issues.createdAt,
  updatedAt: issues.updatedAt,
  assignee: userColumns,
};

export async function loadLabels(db: DbOrTx, issueIds: string[]): Promise<Map<string, Label[]>> {
  const map = new Map<string, Label[]>();
  if (issueIds.length === 0) return map;
  const rows = await db
    .select({ issueId: issueLabels.issueId, id: labels.id, teamId: labels.teamId, name: labels.name, color: labels.color })
    .from(issueLabels)
    .innerJoin(labels, eq(labels.id, issueLabels.labelId))
    .where(inArray(issueLabels.issueId, issueIds))
    .orderBy(asc(labels.name));
  for (const { issueId, ...label } of rows) {
    const list = map.get(issueId) ?? [];
    list.push(label);
    map.set(issueId, list);
  }
  return map;
}

async function queryListItems(db: DbOrTx, where: SQL | undefined): Promise<IssueListItem[]> {
  const rows = await db
    .select(listColumns)
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .leftJoin(users, eq(users.id, issues.assigneeId))
    .where(where)
    .orderBy(asc(issues.sortOrder), desc(issues.createdAt));
  const labelMap = await loadLabels(
    db,
    rows.map((r) => r.id),
  );
  return rows.map(({ teamKey, createdAt, updatedAt, ...row }) => ({
    ...row,
    key: formatIssueKey(teamKey, row.number),
    labels: labelMap.get(row.id) ?? [],
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));
}

export async function listIssues(
  db: DbOrTx,
  filters: IssueFilters,
  userId: string | null,
): Promise<IssueListItem[]> {
  const conds: SQL[] = [];
  if (filters.teamId) conds.push(eq(issues.teamId, filters.teamId));
  if (filters.status?.length) conds.push(inArray(issues.status, filters.status));
  if (filters.priority?.length) conds.push(inArray(issues.priority, filters.priority));
  if (filters.assigneeId?.length) conds.push(inArray(issues.assigneeId, filters.assigneeId));
  if (filters.projectId) conds.push(eq(issues.projectId, filters.projectId));
  if (filters.cycleId) conds.push(eq(issues.cycleId, filters.cycleId));
  if (filters.parentId) conds.push(eq(issues.parentId, filters.parentId));
  if (filters.labelId?.length) {
    conds.push(
      inArray(
        issues.id,
        db.select({ id: issueLabels.issueId }).from(issueLabels).where(inArray(issueLabels.labelId, filters.labelId)),
      ),
    );
  }
  if (filters.mine) {
    if (!userId) throw new HttpError(400, 'user_required', 'X-User-Id header is required');
    conds.push(eq(issues.assigneeId, userId));
  }
  return queryListItems(db, conds.length ? and(...conds) : undefined);
}

async function getIssueDetail(db: DbOrTx, where: SQL): Promise<IssueDetail> {
  const [item] = await queryListItems(db, where);
  if (!item) throw notFound('Issue');

  const [extra] = await db
    .select({ description: issues.description, creator: userColumns })
    .from(issues)
    .innerJoin(users, eq(users.id, issues.creatorId))
    .where(eq(issues.id, item.id));
  const [project] = item.projectId
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, item.projectId))
    : [null];
  const [cycle] = item.cycleId
    ? await db
        .select({ id: cycles.id, number: cycles.number, startsOn: cycles.startsOn, endsOn: cycles.endsOn })
        .from(cycles)
        .where(eq(cycles.id, item.cycleId))
    : [null];
  const [parent] = item.parentId ? await queryListItems(db, eq(issues.id, item.parentId)) : [undefined];
  const children = await queryListItems(db, eq(issues.parentId, item.id));
  const commentRows = await db
    .select({
      id: comments.id,
      issueId: comments.issueId,
      body: comments.body,
      createdAt: comments.createdAt,
      author: userColumns,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.issueId, item.id))
    .orderBy(asc(comments.createdAt));
  const activityRows = await db
    .select({
      id: activity.id,
      issueId: activity.issueId,
      type: activity.type,
      payload: activity.payload,
      createdAt: activity.createdAt,
      actor: userColumns,
    })
    .from(activity)
    .innerJoin(users, eq(users.id, activity.actorId))
    .where(eq(activity.issueId, item.id))
    .orderBy(asc(activity.createdAt));

  return {
    ...item,
    description: extra.description,
    creator: extra.creator,
    project: project ?? null,
    cycle: cycle ?? null,
    parent: parent ? { id: parent.id, key: parent.key, title: parent.title, status: parent.status } : null,
    children,
    comments: commentRows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    activity: activityRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

export async function getIssueByKey(db: DbOrTx, key: string): Promise<IssueDetail> {
  const parsed = parseIssueKey(key);
  if (!parsed) throw notFound('Issue');
  return getIssueDetail(db, and(eq(teams.key, parsed.teamKey), eq(issues.number, parsed.number))!);
}

export async function getIssueById(db: DbOrTx, id: string): Promise<IssueDetail> {
  return getIssueDetail(db, eq(issues.id, id));
}

export async function nextSortOrder(db: DbOrTx, teamId: string, status: IssueStatus): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${issues.sortOrder})` })
    .from(issues)
    .where(and(eq(issues.teamId, teamId), eq(issues.status, status)));
  return (row?.max ?? 0) + 1000;
}

export async function createIssue(db: DbOrTx, input: IssueCreateInput, actorId: string): Promise<IssueDetail> {
  const id = await db.transaction(async (tx) => {
    const [team] = await tx
      .update(teams)
      .set({ issueCounter: sql`${teams.issueCounter} + 1` })
      .where(eq(teams.id, input.teamId))
      .returning({ counter: teams.issueCounter });
    if (!team) throw badRequest('Unknown team');
    await validateRefs(tx, input.teamId, input, null);

    const status = input.status ?? 'todo';
    const [row] = await tx
      .insert(issues)
      .values({
        teamId: input.teamId,
        number: team.counter,
        title: input.title,
        description: input.description ?? '',
        status,
        priority: input.priority ?? 'none',
        assigneeId: input.assigneeId ?? null,
        creatorId: actorId,
        projectId: input.projectId ?? null,
        cycleId: input.cycleId ?? null,
        parentId: input.parentId ?? null,
        dueDate: input.dueDate ?? null,
        estimate: input.estimate ?? null,
        sortOrder: await nextSortOrder(tx, input.teamId, status),
      })
      .returning({ id: issues.id });

    const labelIds = [...new Set(input.labelIds ?? [])];
    if (labelIds.length) {
      await tx.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId: row.id, labelId })));
    }
    await tx.insert(activity).values({ issueId: row.id, actorId, type: 'created', payload: {} });
    return row.id;
  });
  return getIssueById(db, id);
}
```

- [ ] **Step 7: Implement the issue routes and register them**

`apps/api/src/routes/issues.ts`:
```ts
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
```

In `apps/api/src/app.ts` add `import { issueRoutes } from './routes/issues';` and inside the `/api` plugin add `await api.register(issueRoutes);` after `cycleRoutes`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter @tm/api test && pnpm --filter @tm/api typecheck`
Expected: all tests PASS, typecheck exits 0.

- [ ] **Step 9: Commit**

```bash
git add apps/api
git commit -m "feat(api): create, list and fetch issues with per-team numbering"
```

---

### Task 5: Issues — update with activity, delete, comments

**Files:**
- Modify: `apps/api/src/services/issues.ts` (add `updateIssue`, `deleteIssue`, `addComment`)
- Modify: `apps/api/src/routes/issues.ts` (PATCH, DELETE, POST comments)
- Test: `apps/api/test/issues-update.test.ts`

**Interfaces:**
- Consumes: `getIssueById`, `nextSortOrder`, `validateRefs` (Task 4); `issueUpdateSchema`, `commentCreateSchema`, `idParamsSchema`.
- Produces:
  - `updateIssue(db, id, patch: IssueUpdateInput, actorId): Promise<IssueDetail>`
  - `deleteIssue(db, id): Promise<void>`
  - `addComment(db, issueId, body, authorId): Promise<CommentDto>`
  - Activity payloads (consumed by the web `describeActivity` in Task 9):
    - `status` / `priority`: `{ from: enum, to: enum }`
    - `title`: `{ from: string, to: string }`
    - `assignee`: `{ from: userName | null, to: userName | null }`
    - `project`: `{ from: projectName | null, to: projectName | null }`
    - `cycle`: `{ from: 'Cycle 14' | null, to: 'Cycle 15' | null }`
    - `due_date`: `{ from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }`
    - `estimate`: `{ from: number | null, to: number | null }`
    - `parent`: `{ from: 'DEV-1' | null, to: 'DEV-2' | null }`
    - `labels`: `{ added: string[], removed: string[] }` (label names)
    - `comment`: `{ commentId }`; `created`: `{}`
- HTTP: `PATCH /api/issues/:id` (200, IssueDetail), `DELETE /api/issues/:id` (204), `POST /api/issues/:id/comments` (201, CommentDto)

- [ ] **Step 1: Write the failing tests**

`apps/api/test/issues-update.test.ts`:
```ts
import type { CommentDto, IssueDetail } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;
let issue: IssueDetail;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
  issue = await createIssueVia(ctx, fx.alice, {
    teamId: fx.dev.id,
    title: 'Target',
    priority: 'medium',
    assigneeId: fx.alice.id,
    labelIds: [fx.bug.id],
    projectId: fx.project.id,
    cycleId: fx.cycle.id,
    dueDate: '2026-10-17',
    estimate: 3,
  });
});

const patch = (id: string, body: Record<string, unknown>, headers: Record<string, string> = as(fx.bob)) =>
  ctx.app.inject({ method: 'PATCH', url: `/api/issues/${id}`, headers, payload: body });

const ok = async (id: string, body: Record<string, unknown>) => {
  const res = await patch(id, body);
  expect(res.statusCode).toBe(200);
  return res.json() as IssueDetail;
};

describe('PATCH /api/issues/:id', () => {
  it('records a status change and moves the issue to the bottom of the new status', async () => {
    await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Busy', status: 'in_progress' });
    const updated = await ok(issue.id, { status: 'in_progress' });
    expect(updated.status).toBe('in_progress');
    expect(updated.sortOrder).toBe(2000);
    expect(updated.activity.at(-1)).toMatchObject({
      type: 'status',
      payload: { from: 'todo', to: 'in_progress' },
      actor: { id: fx.bob.id },
    });
  });

  it('uses an explicit sortOrder when given', async () => {
    const updated = await ok(issue.id, { status: 'done', sortOrder: 1500 });
    expect(updated).toMatchObject({ status: 'done', sortOrder: 1500 });
  });

  it('clears nullable fields and describes the removals', async () => {
    const updated = await ok(issue.id, {
      assigneeId: null,
      dueDate: null,
      estimate: null,
      projectId: null,
      cycleId: null,
    });
    expect(updated).toMatchObject({
      assignee: null,
      dueDate: null,
      estimate: null,
      projectId: null,
      project: null,
      cycleId: null,
      cycle: null,
    });
    const payloads = Object.fromEntries(updated.activity.map((a) => [a.type, a.payload]));
    expect(payloads.assignee).toEqual({ from: 'Alice Doe', to: null });
    expect(payloads.due_date).toEqual({ from: '2026-10-17', to: null });
    expect(payloads.estimate).toEqual({ from: 3, to: null });
    expect(payloads.project).toEqual({ from: 'Mobile app 2.0', to: null });
    expect(payloads.cycle).toEqual({ from: 'Cycle 14', to: null });
  });

  it('diffs labels and skips unchanged label sets', async () => {
    const updated = await ok(issue.id, { labelIds: [fx.feat.id] });
    expect(updated.labels.map((l) => l.name)).toEqual(['Feature']);
    expect(updated.activity.at(-1)).toMatchObject({ type: 'labels', payload: { added: ['Feature'], removed: ['Bug'] } });
    const again = await ok(issue.id, { labelIds: [fx.feat.id] });
    expect(again.activity).toHaveLength(updated.activity.length);
  });

  it('does not record no-op changes', async () => {
    const updated = await ok(issue.id, { status: 'todo', priority: 'medium', title: 'Target' });
    expect(updated.activity.map((a) => a.type)).toEqual(['created']);
  });

  it('updates the description without an activity entry', async () => {
    const updated = await ok(issue.id, { description: 'Steps to reproduce' });
    expect(updated.description).toBe('Steps to reproduce');
    expect(updated.activity).toHaveLength(1);
    expect(updated.updatedAt > issue.updatedAt).toBe(true);
  });

  it('records renames and priority changes', async () => {
    const updated = await ok(issue.id, { title: 'Renamed', priority: 'urgent' });
    const payloads = Object.fromEntries(updated.activity.map((a) => [a.type, a.payload]));
    expect(payloads.title).toEqual({ from: 'Target', to: 'Renamed' });
    expect(payloads.priority).toEqual({ from: 'medium', to: 'urgent' });
  });

  it('records parent changes by key', async () => {
    const parent = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Parent' });
    const updated = await ok(issue.id, { parentId: parent.id });
    expect(updated.parent?.key).toBe(parent.key);
    expect(updated.activity.at(-1)).toMatchObject({ type: 'parent', payload: { from: null, to: parent.key } });
  });

  it('rejects self and circular parents', async () => {
    const child = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Child', parentId: issue.id });
    expect((await patch(issue.id, { parentId: issue.id })).statusCode).toBe(409);
    expect((await patch(issue.id, { parentId: child.id })).statusCode).toBe(409);
  });

  it('validates input', async () => {
    expect((await patch(issue.id, {})).statusCode).toBe(400);
    expect((await patch(issue.id, { status: 'nope' })).statusCode).toBe(400);
    expect((await patch(issue.id, { labelIds: [fx.brand.id] })).statusCode).toBe(400);
    expect((await patch('6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', { title: 'x' })).statusCode).toBe(404);
    expect((await patch(issue.id, { title: 'x' }, {})).statusCode).toBe(400);
  });
});

describe('DELETE /api/issues/:id', () => {
  it('deletes the issue and detaches its children', async () => {
    const child = await createIssueVia(ctx, fx.alice, { teamId: fx.dev.id, title: 'Child', parentId: issue.id });
    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/issues/${issue.id}`, headers: as(fx.bob) });
    expect(res.statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/issues/${issue.key}` })).statusCode).toBe(404);
    const orphan = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${child.key}` })).json() as IssueDetail;
    expect(orphan.parent).toBeNull();
    const again = await ctx.app.inject({ method: 'DELETE', url: `/api/issues/${issue.id}`, headers: as(fx.bob) });
    expect(again.statusCode).toBe(404);
  });
});

describe('POST /api/issues/:id/comments', () => {
  const comment = (id: string, body: unknown, headers: Record<string, string> = as(fx.bob)) =>
    ctx.app.inject({ method: 'POST', url: `/api/issues/${id}/comments`, headers, payload: { body } });

  it('adds a comment with its author and a comment activity', async () => {
    const res = await comment(issue.id, '  Looks good  ');
    expect(res.statusCode).toBe(201);
    const created = res.json() as CommentDto;
    expect(created).toMatchObject({ body: 'Looks good', author: { id: fx.bob.id, name: 'Bob Roe' } });
    const detail = (await ctx.app.inject({ method: 'GET', url: `/api/issues/${issue.key}` })).json() as IssueDetail;
    expect(detail.comments.map((c) => c.id)).toEqual([created.id]);
    expect(detail.activity.at(-1)).toMatchObject({ type: 'comment', payload: { commentId: created.id } });
  });

  it('rejects blank comments, unknown issues and missing users', async () => {
    expect((await comment(issue.id, '   ')).statusCode).toBe(400);
    expect((await comment('6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', 'hi')).statusCode).toBe(404);
    expect((await comment(issue.id, 'hi', {})).statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/api test issues-update`
Expected: FAIL — PATCH returns 404 `Route not found`.

- [ ] **Step 3: Implement update, delete and comments in the service**

Add to `apps/api/src/services/issues.ts` (extend imports: `type CommentDto`, `type IssueUpdateInput` from `@tm/shared`; `type ActivityType` from `@tm/shared`):
```ts
async function userName(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
  return row?.name ?? null;
}

async function projectName(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, id));
  return row?.name ?? null;
}

async function cycleName(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ number: cycles.number }).from(cycles).where(eq(cycles.id, id));
  return row ? `Cycle ${row.number}` : null;
}

async function issueKeyOf(db: DbOrTx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db
    .select({ key: teams.key, number: issues.number })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .where(eq(issues.id, id));
  return row ? formatIssueKey(row.key, row.number) : null;
}

interface PendingActivity {
  type: ActivityType;
  payload: Record<string, unknown>;
}

export async function updateIssue(
  db: DbOrTx,
  id: string,
  patch: IssueUpdateInput,
  actorId: string,
): Promise<IssueDetail> {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(issues).where(eq(issues.id, id)).for('update');
    if (!cur) throw notFound('Issue');
    await validateRefs(tx, cur.teamId, patch, id);

    const set: Partial<typeof issues.$inferInsert> = {};
    const events: PendingActivity[] = [];

    if (patch.title !== undefined && patch.title !== cur.title) {
      set.title = patch.title;
      events.push({ type: 'title', payload: { from: cur.title, to: patch.title } });
    }
    if (patch.description !== undefined && patch.description !== cur.description) {
      set.description = patch.description;
    }
    if (patch.status !== undefined && patch.status !== cur.status) {
      set.status = patch.status;
      events.push({ type: 'status', payload: { from: cur.status, to: patch.status } });
    }
    if (patch.priority !== undefined && patch.priority !== cur.priority) {
      set.priority = patch.priority;
      events.push({ type: 'priority', payload: { from: cur.priority, to: patch.priority } });
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== cur.assigneeId) {
      set.assigneeId = patch.assigneeId;
      events.push({
        type: 'assignee',
        payload: { from: await userName(tx, cur.assigneeId), to: await userName(tx, patch.assigneeId) },
      });
    }
    if (patch.projectId !== undefined && patch.projectId !== cur.projectId) {
      set.projectId = patch.projectId;
      events.push({
        type: 'project',
        payload: { from: await projectName(tx, cur.projectId), to: await projectName(tx, patch.projectId) },
      });
    }
    if (patch.cycleId !== undefined && patch.cycleId !== cur.cycleId) {
      set.cycleId = patch.cycleId;
      events.push({
        type: 'cycle',
        payload: { from: await cycleName(tx, cur.cycleId), to: await cycleName(tx, patch.cycleId) },
      });
    }
    if (patch.parentId !== undefined && patch.parentId !== cur.parentId) {
      set.parentId = patch.parentId;
      events.push({
        type: 'parent',
        payload: { from: await issueKeyOf(tx, cur.parentId), to: await issueKeyOf(tx, patch.parentId) },
      });
    }
    if (patch.dueDate !== undefined && patch.dueDate !== cur.dueDate) {
      set.dueDate = patch.dueDate;
      events.push({ type: 'due_date', payload: { from: cur.dueDate, to: patch.dueDate } });
    }
    if (patch.estimate !== undefined && patch.estimate !== cur.estimate) {
      set.estimate = patch.estimate;
      events.push({ type: 'estimate', payload: { from: cur.estimate, to: patch.estimate } });
    }
    if (patch.sortOrder !== undefined) {
      set.sortOrder = patch.sortOrder;
    } else if (set.status) {
      set.sortOrder = await nextSortOrder(tx, cur.teamId, set.status);
    }

    let labelsChanged = false;
    if (patch.labelIds !== undefined) {
      const current = await tx
        .select({ id: labels.id, name: labels.name })
        .from(issueLabels)
        .innerJoin(labels, eq(labels.id, issueLabels.labelId))
        .where(eq(issueLabels.issueId, id));
      const next = new Set(patch.labelIds);
      const currentIds = new Set(current.map((l) => l.id));
      const removed = current.filter((l) => !next.has(l.id));
      const addedIds = [...next].filter((labelId) => !currentIds.has(labelId));
      if (removed.length) {
        await tx.delete(issueLabels).where(
          and(
            eq(issueLabels.issueId, id),
            inArray(
              issueLabels.labelId,
              removed.map((l) => l.id),
            ),
          ),
        );
      }
      if (addedIds.length) {
        await tx.insert(issueLabels).values(addedIds.map((labelId) => ({ issueId: id, labelId })));
      }
      if (removed.length || addedIds.length) {
        const added = addedIds.length
          ? await tx.select({ name: labels.name }).from(labels).where(inArray(labels.id, addedIds)).orderBy(asc(labels.name))
          : [];
        events.push({
          type: 'labels',
          payload: { added: added.map((l) => l.name), removed: removed.map((l) => l.name) },
        });
        labelsChanged = true;
      }
    }

    if (Object.keys(set).length || labelsChanged) {
      set.updatedAt = new Date();
      await tx.update(issues).set(set).where(eq(issues.id, id));
    }
    if (events.length) {
      await tx.insert(activity).values(events.map((e) => ({ issueId: id, actorId, ...e })));
    }
  });
  return getIssueById(db, id);
}

export async function deleteIssue(db: DbOrTx, id: string): Promise<void> {
  const deleted = await db.delete(issues).where(eq(issues.id, id)).returning({ id: issues.id });
  if (deleted.length === 0) throw notFound('Issue');
}

export async function addComment(db: DbOrTx, issueId: string, body: string, authorId: string): Promise<CommentDto> {
  return db.transaction(async (tx) => {
    const [issue] = await tx.select({ id: issues.id }).from(issues).where(eq(issues.id, issueId));
    if (!issue) throw notFound('Issue');
    const [row] = await tx.insert(comments).values({ issueId, authorId, body }).returning();
    await tx.insert(activity).values({ issueId, actorId: authorId, type: 'comment', payload: { commentId: row.id } });
    const [author] = await tx.select(userColumns).from(users).where(eq(users.id, authorId));
    return { id: row.id, issueId, body: row.body, createdAt: row.createdAt.toISOString(), author };
  });
}
```

- [ ] **Step 4: Add the routes**

In `apps/api/src/routes/issues.ts` extend imports (`commentCreateSchema`, `idParamsSchema`, `issueUpdateSchema` from `@tm/shared`; `addComment`, `deleteIssue`, `updateIssue` from `../services/issues`) and append inside `issueRoutes`:
```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/api test && pnpm --filter @tm/api typecheck`
Expected: all tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): update issues with activity log, delete issues, comments"
```

---

### Task 6: Inbox and saved views

**Files:**
- Create: `apps/api/src/services/inbox.ts`, `apps/api/src/routes/inbox.ts`, `apps/api/src/routes/views.ts`
- Modify: `apps/api/src/app.ts` (register `inboxRoutes`, `viewRoutes`)
- Test: `apps/api/test/inbox.test.ts`, `apps/api/test/views.test.ts`

**Interfaces:**
- Consumes: tables, `userColumns`, `requireUserId`, `assertTeamExists`, `inboxReadSchema`, `viewCreateSchema`, `viewUpdateSchema`, `idParamsSchema`.
- Produces:
  - `getInbox(db, userId): Promise<InboxResponse>` — activity on issues where the user is assignee or creator, excluding the user's own actions, newest first, max 200; `unreadCount` over all visible unread
  - `markInboxRead(db, userId, input: InboxReadInput): Promise<void>` — ignores ids not visible to the user
  - HTTP: `GET /api/inbox`, `POST /api/inbox/read` (204), `GET|POST /api/views`, `GET|PATCH|DELETE /api/views/:id`

- [ ] **Step 1: Write the failing tests**

`apps/api/test/inbox.test.ts`:
```ts
import type { IssueDetail, InboxResponse } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createIssueVia, createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;
let mine: IssueDetail;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
  // Bob creates an issue assigned to Alice, then changes its status.
  mine = await createIssueVia(ctx, fx.bob, { teamId: fx.dev.id, title: 'For Alice', assigneeId: fx.alice.id });
  await ctx.app.inject({
    method: 'PATCH',
    url: `/api/issues/${mine.id}`,
    headers: as(fx.bob),
    payload: { status: 'in_progress' },
  });
  // Alice's own action must not appear in her inbox.
  await ctx.app.inject({
    method: 'PATCH',
    url: `/api/issues/${mine.id}`,
    headers: as(fx.alice),
    payload: { priority: 'high' },
  });
});

const inbox = async (user: { id: string }) => {
  const res = await ctx.app.inject({ method: 'GET', url: '/api/inbox', headers: as(user) });
  expect(res.statusCode).toBe(200);
  return res.json() as InboxResponse;
};

const markRead = (user: { id: string }, payload: unknown) =>
  ctx.app.inject({ method: 'POST', url: '/api/inbox/read', headers: as(user), payload: payload as object });

describe('inbox', () => {
  it("shows other people's activity on my issues, newest first", async () => {
    const data = await inbox(fx.alice);
    expect(data.unreadCount).toBe(2);
    expect(data.items.map((i) => i.activity.type)).toEqual(['status', 'created']);
    expect(data.items[0]).toMatchObject({
      read: false,
      issue: { id: mine.id, key: mine.key, title: 'For Alice', status: 'in_progress' },
      activity: { actor: { id: fx.bob.id } },
    });
  });

  it('shows the creator activity by others on issues they created', async () => {
    const data = await inbox(fx.bob);
    expect(data.items.map((i) => i.activity.type)).toEqual(['priority']);
  });

  it('marks selected items as read', async () => {
    const before = await inbox(fx.alice);
    const res = await markRead(fx.alice, { activityIds: [before.items[0].activity.id] });
    expect(res.statusCode).toBe(204);
    const after = await inbox(fx.alice);
    expect(after.unreadCount).toBe(1);
    expect(after.items[0].read).toBe(true);
  });

  it('marks everything as read and ignores ids the user cannot see', async () => {
    const bobItems = await inbox(fx.bob);
    expect((await markRead(fx.alice, { activityIds: [bobItems.items[0].activity.id] })).statusCode).toBe(204);
    expect((await inbox(fx.alice)).unreadCount).toBe(2);
    expect((await markRead(fx.alice, { all: true })).statusCode).toBe(204);
    expect((await inbox(fx.alice)).unreadCount).toBe(0);
  });

  it('requires a current user', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/inbox' })).statusCode).toBe(400);
    expect((await markRead(fx.alice, {})).statusCode).toBe(400);
  });
});
```

`apps/api/test/views.test.ts`:
```ts
import type { View } from '@tm/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, seedFixture, type Fixture, type TestContext } from './helpers';

let ctx: TestContext;
let fx: Fixture;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetDb(ctx.db);
  fx = await seedFixture(ctx.db);
});

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  ctx.app.inject({ method, url, payload });

describe('views', () => {
  it('supports the full CRUD cycle', async () => {
    const created = await req('POST', '/api/views', {
      name: 'Urgent bugs',
      filters: { teamId: fx.dev.id, priority: ['urgent', 'high'], labelId: [fx.bug.id] },
    });
    expect(created.statusCode).toBe(201);
    const view = created.json() as View;
    expect(view).toMatchObject({
      name: 'Urgent bugs',
      filters: { teamId: fx.dev.id, priority: ['urgent', 'high'], labelId: [fx.bug.id] },
    });

    expect(((await req('GET', '/api/views')).json() as View[]).map((v) => v.id)).toEqual([view.id]);
    expect((await req('GET', `/api/views/${view.id}`)).json()).toMatchObject({ name: 'Urgent bugs' });

    const renamed = await req('PATCH', `/api/views/${view.id}`, { name: 'Hot bugs' });
    expect(renamed.json()).toMatchObject({ name: 'Hot bugs', filters: { priority: ['urgent', 'high'] } });

    const refiltered = await req('PATCH', `/api/views/${view.id}`, { filters: { status: ['todo'] } });
    expect((refiltered.json() as View).filters).toEqual({ status: ['todo'] });

    expect((await req('DELETE', `/api/views/${view.id}`)).statusCode).toBe(204);
    expect((await req('GET', `/api/views/${view.id}`)).statusCode).toBe(404);
    expect((await req('DELETE', `/api/views/${view.id}`)).statusCode).toBe(404);
  });

  it('validates names, filters and teams', async () => {
    expect((await req('POST', '/api/views', { name: '  ' })).statusCode).toBe(400);
    expect((await req('POST', '/api/views', { name: 'x', filters: { status: ['nope'] } })).statusCode).toBe(400);
    const unknownTeam = await req('POST', '/api/views', {
      name: 'x',
      filters: { teamId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' },
    });
    expect(unknownTeam.statusCode).toBe(400);
    expect((await req('PATCH', '/api/views/6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', { name: 'x' })).statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/api test inbox views`
Expected: FAIL — `/api/inbox` and `/api/views` return 404.

- [ ] **Step 3: Implement the inbox service and routes**

`apps/api/src/services/inbox.ts`:
```ts
import { formatIssueKey, type InboxReadInput, type InboxResponse } from '@tm/shared';
import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { userColumns } from '../db/columns';
import { activity, inboxReads, issues, teams, users } from '../db/schema';

function visibleTo(userId: string): SQL {
  return and(or(eq(issues.assigneeId, userId), eq(issues.creatorId, userId)), ne(activity.actorId, userId))!;
}

export async function getInbox(db: DbOrTx, userId: string): Promise<InboxResponse> {
  const readJoin = and(eq(inboxReads.activityId, activity.id), eq(inboxReads.userId, userId));
  const rows = await db
    .select({
      id: activity.id,
      issueId: activity.issueId,
      type: activity.type,
      payload: activity.payload,
      createdAt: activity.createdAt,
      actor: userColumns,
      teamKey: teams.key,
      number: issues.number,
      title: issues.title,
      status: issues.status,
      readId: inboxReads.activityId,
    })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .innerJoin(users, eq(users.id, activity.actorId))
    .leftJoin(inboxReads, readJoin)
    .where(visibleTo(userId))
    .orderBy(desc(activity.createdAt))
    .limit(200);
  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .leftJoin(inboxReads, readJoin)
    .where(and(visibleTo(userId), isNull(inboxReads.activityId)));

  return {
    unreadCount: unread?.count ?? 0,
    items: rows.map((r) => ({
      read: r.readId !== null,
      activity: {
        id: r.id,
        issueId: r.issueId,
        type: r.type,
        payload: r.payload,
        createdAt: r.createdAt.toISOString(),
        actor: r.actor,
      },
      issue: { id: r.issueId, key: formatIssueKey(r.teamKey, r.number), title: r.title, status: r.status },
    })),
  };
}

export async function markInboxRead(db: DbOrTx, userId: string, input: InboxReadInput): Promise<void> {
  const conds: SQL[] = [visibleTo(userId)];
  if ('activityIds' in input) conds.push(inArray(activity.id, input.activityIds));
  const ids = await db
    .select({ id: activity.id })
    .from(activity)
    .innerJoin(issues, eq(issues.id, activity.issueId))
    .where(and(...conds));
  if (ids.length === 0) return;
  await db
    .insert(inboxReads)
    .values(ids.map((row) => ({ userId, activityId: row.id })))
    .onConflictDoNothing();
}
```

`apps/api/src/routes/inbox.ts`:
```ts
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
```

- [ ] **Step 4: Implement the views routes**

`apps/api/src/routes/views.ts`:
```ts
import { idParamsSchema, viewCreateSchema, viewUpdateSchema, type View } from '@tm/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { views } from '../db/schema';
import { notFound } from '../errors';
import { assertTeamExists } from '../services/refs';

function toView(row: typeof views.$inferSelect): View {
  return { id: row.id, name: row.name, filters: row.filters, createdAt: row.createdAt.toISOString() };
}

export async function viewRoutes(app: FastifyInstance) {
  app.get('/views', async () => (await app.db.select().from(views).orderBy(asc(views.createdAt))).map(toView));

  app.get('/views/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const [row] = await app.db.select().from(views).where(eq(views.id, id));
    if (!row) throw notFound('View');
    return toView(row);
  });

  app.post('/views', async (req, reply) => {
    const input = viewCreateSchema.parse(req.body);
    if (input.filters.teamId) await assertTeamExists(app.db, input.filters.teamId);
    const [row] = await app.db.insert(views).values({ name: input.name, filters: input.filters }).returning();
    return reply.status(201).send(toView(row));
  });

  app.patch('/views/:id', async (req) => {
    const { id } = idParamsSchema.parse(req.params);
    const input = viewUpdateSchema.parse(req.body);
    if (input.filters?.teamId) await assertTeamExists(app.db, input.filters.teamId);
    const [row] = await app.db.update(views).set(input).where(eq(views.id, id)).returning();
    if (!row) throw notFound('View');
    return toView(row);
  });

  app.delete('/views/:id', async (req, reply) => {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await app.db.delete(views).where(eq(views.id, id)).returning({ id: views.id });
    if (deleted.length === 0) throw notFound('View');
    return reply.status(204).send();
  });
}
```

In `apps/api/src/app.ts` add imports for `inboxRoutes` and `viewRoutes` and register them after `issueRoutes`:
```ts
      await api.register(inboxRoutes);
      await api.register(viewRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/api test && pnpm --filter @tm/api typecheck`
Expected: all tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): inbox with read tracking and saved views"
```

---

### Task 7: Seed data from the mockups

**Files:**
- Create: `apps/api/src/db/seed.ts`, `apps/api/scripts/seed.ts`
- Modify: `apps/api/package.json` (scripts `db:seed`, `db:setup`)
- Test: `apps/api/test/seed.test.ts`

**Interfaces:**
- Consumes: tables, `truncateAll`, `getIssueByKey`, `getInbox`.
- Produces: `seed(db: DbOrTx): Promise<void>` — idempotent (truncate + insert in one transaction). Data: users Anna Romanova (AR, #6D4FC2), Max Kim (MK, #2F7D6D), Denis Sokolov (DS, #B5582F), Elena Volkova (EV, #3F6FB5); teams Engineering `DEV` #2F7D6D (counter 161) and Design `DES` #B5582F (counter 2); DEV labels Bug #EB5757, Feature #A78BFA, Mobile #4EA7FC, Infra #2FB5A5, Design #F07CB4, Docs #8E8E97; DES labels Design #F07CB4, Research #4EA7FC; project "Mobile app 2.0"; DEV cycles 13 (2026-09-22..10-05) and 14 (2026-10-06..10-19); the mockup issues with their numbers; DEV-143..145 as sub-issues of DEV-142; Max's comment; 3 unread inbox items for Anna; one saved view "Urgent & high bugs".

- [ ] **Step 1: Write the failing test**

`apps/api/test/seed.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../src/db/schema';
import { seed } from '../src/db/seed';
import { getInbox } from '../src/services/inbox';
import { getIssueByKey, listIssues } from '../src/services/issues';
import { openTestDb } from './helpers';

const { db, pool } = openTestDb();

beforeAll(async () => {
  await seed(db);
  await seed(db); // idempotent
});
afterAll(async () => {
  await pool.end();
});

describe('seed', () => {
  it('creates the mockup data', async () => {
    expect(await db.select().from(users)).toHaveLength(4);
    const issue = await getIssueByKey(db, 'DEV-142');
    expect(issue).toMatchObject({
      title: 'Offline sync for issues',
      status: 'in_progress',
      priority: 'high',
      estimate: 5,
      dueDate: '2026-10-17',
      project: { name: 'Mobile app 2.0' },
      cycle: { number: 14 },
      assignee: { name: 'Anna Romanova' },
    });
    expect(issue.labels.map((l) => l.name)).toEqual(['Feature', 'Mobile']);
    expect(issue.children.map((c) => c.key)).toEqual(['DEV-143', 'DEV-144', 'DEV-145']);
    expect(issue.comments).toHaveLength(1);
    expect(issue.activity.map((a) => a.type)).toEqual(['created', 'status', 'comment']);
  });

  it('continues numbering after the highest seeded number', async () => {
    const all = await listIssues(db, {}, null);
    expect(all.filter((i) => i.key.startsWith('DEV-'))).toHaveLength(17);
    expect(all.filter((i) => i.key.startsWith('DES-'))).toHaveLength(2);
  });

  it('gives Anna three unread inbox items', async () => {
    const [anna] = (await db.select().from(users)).filter((u) => u.initials === 'AR');
    const inbox = await getInbox(db, anna.id);
    expect(inbox.unreadCount).toBe(3);
  });
});
```

Children are ordered by `sortOrder` (position within their status × 1000): DEV-143 (3rd done → 3000), DEV-144 (4th in progress → 4000), DEV-145 (5th todo → 5000).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @tm/api test seed`
Expected: FAIL — cannot resolve `../src/db/seed`.

- [ ] **Step 3: Implement the seed**

`apps/api/src/db/seed.ts`:
```ts
import type { IssuePriority, IssueStatus } from '@tm/shared';
import type { DbOrTx } from './client';
import { activity, comments, cycles, issueLabels, issues, labels, projects, teams, users, views } from './schema';
import { truncateAll } from './truncate';

type Who = 'AR' | 'MK' | 'DS' | 'EV';

interface SeedIssue {
  team: 'DEV' | 'DES';
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  who: Who;
  date: string;
  parent?: number;
  description?: string;
  dueDate?: string;
  estimate?: number;
  project?: boolean;
}

const USERS: { initials: Who; name: string; color: string }[] = [
  { initials: 'AR', name: 'Anna Romanova', color: '#6D4FC2' },
  { initials: 'MK', name: 'Max Kim', color: '#2F7D6D' },
  { initials: 'DS', name: 'Denis Sokolov', color: '#B5582F' },
  { initials: 'EV', name: 'Elena Volkova', color: '#3F6FB5' },
];

const DEV_LABELS = [
  ['Bug', '#EB5757'],
  ['Feature', '#A78BFA'],
  ['Mobile', '#4EA7FC'],
  ['Infra', '#2FB5A5'],
  ['Design', '#F07CB4'],
  ['Docs', '#8E8E97'],
] as const;

const DES_LABELS = [
  ['Design', '#F07CB4'],
  ['Research', '#4EA7FC'],
] as const;

const OFFLINE_DESCRIPTION = [
  'Mobile users lose their changes when the connection drops mid-edit. Edits should be saved locally and sent once the connection is back.',
  '',
  'Acceptance criteria',
  '- Creating and editing issues works offline',
  '- The change queue is sent automatically on reconnect',
  '- Conflicts are shown to the user with a choice of version',
].join('\n');

const ISSUES: SeedIssue[] = [
  { team: 'DEV', number: 151, title: 'Crash when uploading attachments over 25 MB', status: 'in_progress', priority: 'urgent', labels: ['Bug'], who: 'AR', date: '2026-10-07' },
  { team: 'DEV', number: 142, title: 'Offline sync for issues', status: 'in_progress', priority: 'high', labels: ['Feature', 'Mobile'], who: 'AR', date: '2026-10-02', description: OFFLINE_DESCRIPTION, dueDate: '2026-10-17', estimate: 5, project: true },
  { team: 'DEV', number: 139, title: 'Keyboard shortcuts for changing status', status: 'in_progress', priority: 'medium', labels: ['Feature'], who: 'MK', date: '2026-09-30' },
  { team: 'DEV', number: 133, title: 'Move notifications to an event queue', status: 'in_review', priority: 'medium', labels: ['Infra'], who: 'DS', date: '2026-09-28' },
  { team: 'DEV', number: 128, title: 'Dark theme in profile settings', status: 'in_review', priority: 'low', labels: ['Design'], who: 'EV', date: '2026-09-25' },
  { team: 'DEV', number: 160, title: 'Wrong unread count in Inbox', status: 'todo', priority: 'high', labels: ['Bug'], who: 'MK', date: '2026-10-08' },
  { team: 'DEV', number: 156, title: 'Filter by multiple assignees', status: 'todo', priority: 'medium', labels: ['Feature'], who: 'EV', date: '2026-10-06' },
  { team: 'DEV', number: 157, title: 'Export cycle to CSV', status: 'todo', priority: 'low', labels: ['Feature'], who: 'DS', date: '2026-10-06' },
  { team: 'DEV', number: 161, title: 'Document the webhooks API', status: 'todo', priority: 'none', labels: ['Docs'], who: 'DS', date: '2026-10-08' },
  { team: 'DEV', number: 112, title: 'Issue templates for teams', status: 'backlog', priority: 'low', labels: ['Feature'], who: 'EV', date: '2026-09-12' },
  { team: 'DEV', number: 118, title: 'Two-way calendar sync', status: 'backlog', priority: 'none', labels: ['Feature'], who: 'MK', date: '2026-09-15' },
  { team: 'DEV', number: 120, title: 'Bulk edit selected issues', status: 'backlog', priority: 'medium', labels: ['Feature', 'Design'], who: 'AR', date: '2026-09-16' },
  { team: 'DEV', number: 131, title: 'Speed up issue search', status: 'done', priority: 'high', labels: ['Infra'], who: 'DS', date: '2026-09-27' },
  { team: 'DEV', number: 126, title: 'Avatars in the assignee picker', status: 'done', priority: 'low', labels: ['Design'], who: 'EV', date: '2026-09-22' },
  { team: 'DEV', number: 143, title: 'Local storage for drafts', status: 'done', priority: 'medium', labels: ['Mobile'], who: 'AR', date: '2026-10-02', parent: 142, project: true },
  { team: 'DEV', number: 144, title: 'Outgoing change queue', status: 'in_progress', priority: 'medium', labels: ['Mobile'], who: 'AR', date: '2026-10-02', parent: 142, project: true },
  { team: 'DEV', number: 145, title: 'Conflict resolution screen', status: 'todo', priority: 'medium', labels: ['Mobile', 'Design'], who: 'EV', date: '2026-10-02', parent: 142, project: true },
  { team: 'DES', number: 1, title: 'Refresh the icon set', status: 'todo', priority: 'medium', labels: ['Design'], who: 'EV', date: '2026-10-03' },
  { team: 'DES', number: 2, title: 'Onboarding illustrations', status: 'backlog', priority: 'low', labels: ['Research'], who: 'DS', date: '2026-10-04' },
];

const at = (date: string, time = '09:00') => new Date(`${date}T${time}:00Z`);

export async function seed(db: DbOrTx): Promise<void> {
  await db.transaction(async (tx) => {
    await truncateAll(tx);

    const userRows = await tx.insert(users).values(USERS).returning();
    const user = Object.fromEntries(userRows.map((u) => [u.initials, u])) as Record<Who, (typeof userRows)[number]>;

    const [dev, des] = await tx
      .insert(teams)
      .values([
        { name: 'Engineering', key: 'DEV', color: '#2F7D6D', issueCounter: 161 },
        { name: 'Design', key: 'DES', color: '#B5582F', issueCounter: 2 },
      ])
      .returning();
    const team = { DEV: dev, DES: des };

    const devLabels = await tx
      .insert(labels)
      .values(DEV_LABELS.map(([name, color]) => ({ teamId: dev.id, name, color })))
      .returning();
    const desLabels = await tx
      .insert(labels)
      .values(DES_LABELS.map(([name, color]) => ({ teamId: des.id, name, color })))
      .returning();
    const labelId = (teamKey: 'DEV' | 'DES', name: string) =>
      (teamKey === 'DEV' ? devLabels : desLabels).find((l) => l.name === name)!.id;

    const [mobile] = await tx.insert(projects).values({ teamId: dev.id, name: 'Mobile app 2.0', createdAt: at('2026-09-01') }).returning();
    const [cycle13, cycle14] = await tx
      .insert(cycles)
      .values([
        { teamId: dev.id, number: 13, startsOn: '2026-09-22', endsOn: '2026-10-05' },
        { teamId: dev.id, number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' },
      ])
      .returning();

    const positions = new Map<string, number>();
    const ids = new Map<string, string>();
    for (const item of ISSUES) {
      const bucket = `${item.team}:${item.status}`;
      const position = (positions.get(bucket) ?? 0) + 1;
      positions.set(bucket, position);
      const cycleId =
        item.team !== 'DEV' || item.status === 'backlog'
          ? null
          : item.status === 'done' && !item.parent
            ? cycle13.id
            : cycle14.id;
      const [row] = await tx
        .insert(issues)
        .values({
          teamId: team[item.team].id,
          number: item.number,
          title: item.title,
          description: item.description ?? '',
          status: item.status,
          priority: item.priority,
          assigneeId: user[item.who].id,
          creatorId: user[item.who].id,
          projectId: item.project ? mobile.id : null,
          cycleId,
          parentId: item.parent ? ids.get(`DEV-${item.parent}`)! : null,
          dueDate: item.dueDate ?? null,
          estimate: item.estimate ?? null,
          sortOrder: position * 1000,
          createdAt: at(item.date),
          updatedAt: at(item.date),
        })
        .returning({ id: issues.id });
      ids.set(`${item.team}-${item.number}`, row.id);
      await tx.insert(issueLabels).values(item.labels.map((name) => ({ issueId: row.id, labelId: labelId(item.team, name) })));
      await tx.insert(activity).values({ issueId: row.id, actorId: user[item.who].id, type: 'created', payload: {}, createdAt: at(item.date) });
    }

    const offline = ids.get('DEV-142')!;
    await tx.insert(activity).values({
      issueId: offline,
      actorId: user.AR.id,
      type: 'status',
      payload: { from: 'todo', to: 'in_progress' },
      createdAt: at('2026-10-05'),
    });
    const [comment] = await tx
      .insert(comments)
      .values({
        issueId: offline,
        authorId: user.MK.id,
        body: 'For the queue I suggest storing operations rather than issue snapshots — that makes conflicts much easier to resolve.',
        createdAt: at('2026-10-06', '10:00'),
      })
      .returning();
    await tx.insert(activity).values([
      { issueId: offline, actorId: user.MK.id, type: 'comment', payload: { commentId: comment.id }, createdAt: at('2026-10-06', '10:00') },
      { issueId: ids.get('DEV-151')!, actorId: user.MK.id, type: 'priority', payload: { from: 'high', to: 'urgent' }, createdAt: at('2026-10-07', '12:00') },
      { issueId: ids.get('DEV-120')!, actorId: user.EV.id, type: 'labels', payload: { added: ['Design'], removed: [] }, createdAt: at('2026-09-17') },
    ]);

    await tx.insert(views).values({
      name: 'Urgent & high bugs',
      filters: { teamId: dev.id, priority: ['urgent', 'high'], labelId: [labelId('DEV', 'Bug')] },
    });
  });
}
```

`apps/api/scripts/seed.ts`:
```ts
import { env } from '../src/config';
import { createDb } from '../src/db/client';
import { seed } from '../src/db/seed';

const { db, pool } = createDb(env.databaseUrl);
await seed(db);
await pool.end();
console.log('✓ seed data loaded');
```

In `apps/api/package.json` set:
```json
    "db:setup": "tsx scripts/db-setup.ts && tsx scripts/seed.ts",
    "db:seed": "tsx scripts/seed.ts"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tm/api test && pnpm --filter @tm/api typecheck`
Expected: all tests PASS (the seed test file runs against the shared test DB; other files reset it in `beforeEach`).

- [ ] **Step 5: Load the dev database and smoke-test with curl**

Run: `pnpm db:setup`
Expected: `✓ taskmanager is ready`, `✓ taskmanager_test is ready`, `✓ seed data loaded`.

Run: `pnpm --filter @tm/api start` (background), then `curl -s localhost:3001/api/issues/DEV-142 | head -c 300`
Expected: JSON starting with `{"id":"…","teamId":"…","number":142,"title":"Offline sync for issues"`. Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): seed data matching the mockups"
```

---
### Task 8: Web shell — Vite app, tokens, API client, current user, sidebar, MSW test backend

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`
- Create: `apps/web/src/api/client.ts`, `apps/web/src/api/queries.ts`
- Create: `apps/web/src/lib/cx.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/lib/currentUser.tsx`, `apps/web/src/lib/toast.tsx`, `apps/web/src/lib/toast.module.css`
- Create: `apps/web/src/components/icons.tsx`, `primitives.tsx`, `primitives.module.css`, `states.tsx`, `states.module.css`, `AppLayout.tsx`, `AppLayout.module.css`, `Sidebar.tsx`, `Sidebar.module.css`, `PageHeader.tsx`, `PageHeader.module.css`
- Create: `apps/web/src/pages/NotFound.tsx`, `apps/web/src/pages/page.module.css`
- Create: `apps/web/src/test/setup.ts`, `apps/web/src/test/server.ts`, `apps/web/src/test/render.tsx`
- Test: `apps/web/src/api/client.test.ts`, `apps/web/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: DTO and input types from `@tm/shared`; API contract from Tasks 3–6.
- Produces:
  - `api` object (`users, teams, labels, projects, project, createProject, cycles, cycle, issues, issue, createIssue, updateIssue, deleteIssue, addComment, inbox, markRead, views, view, createView, updateView, deleteView`), `ApiError(status, code, message)`, `setApiUser(id)`, `toQuery(params: object): string` (`src/api/client.ts`)
  - query keys `qk` and hooks `useUsers, useTeams, useTeamByKey(key), useLabels(teamId?), useProjects(teamId?), useProject(id), useCycles(teamId?), useCycle(id), useIssues(filters, { scope?, enabled? }), useIssue(key), useInbox(userId), useViews(), useView(id)` (`src/api/queries.ts`)
  - `CurrentUserProvider`, `useCurrentUser(): { user: User | null; users: User[]; setUserId(id) }` — localStorage key `tm.currentUserId`
  - `ToastProvider`, `useToast(): { show(message, tone?: 'info' | 'error') }`
  - `cx(...classes)`, `storage.get(key)`, `storage.set(key, value)`
  - icons: `SearchIcon, PencilIcon, InboxIcon, MyIssuesIcon, ProjectIcon, ViewsIcon, PlusIcon, ChevronIcon, FilterIcon, ListIcon, BoardIcon, DisplayIcon, CheckIcon, TrashIcon, CloseIcon, StatusIcon({ status, size? }), PriorityIcon({ priority, size? })`
  - primitives: `Avatar({ user, size? })`, `LabelChip({ label })`, `TeamBadge({ team })`, `TeamCrumb({ team })`, `Progress({ done, total })`
  - states: `EmptyState({ title, description?, action? })`, `ErrorState({ error, onRetry? })`, `ListSkeleton({ rows? })`
  - `PageHeader({ crumbs: { label: ReactNode; to?: string }[]; children? })`
  - `AppProviders`, `AppRoutes` (`src/App.tsx`) — later tasks add routes and providers here
  - page styles `page.module.css` classes: `scroll`, `spacer`, `actions`, `tabs`, `tab`, `tabActive`, `content`
  - test utilities: `renderApp(route)`, `renderWithProviders(ui)`, `mock` (state + recorded requests), `server`, fixtures `anna, max, dev, des, bug, feature, mobile, cycle14`

- [ ] **Step 1: Create the web package and configs**

`apps/web/package.json`:
```json
{
  "name": "@tm/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tanstack/react-query": "^5.104.1",
    "@tm/shared": "workspace:*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router": "^7.18.4",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.10.0",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^5.2.0",
    "jsdom": "^26.1.0",
    "msw": "^2.15.0",
    "typescript": "^5.9.3",
    "vite": "^7.3.7",
    "vitest": "^3.2.7"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: true },
});
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Task Manager</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Run: `pnpm install`
Expected: installs without errors.

- [ ] **Step 2: Create the test infrastructure (MSW in-memory backend)**

`apps/web/src/test/server.ts`:
```ts
import type {
  ActivityEntry,
  CommentDto,
  Cycle,
  InboxItem,
  InboxReadInput,
  IssueCreateInput,
  IssueDetail,
  IssueListItem,
  IssuePriority,
  IssueStatus,
  IssueUpdateInput,
  Label,
  Project,
  Team,
  User,
  View,
  ViewCreateInput,
  ViewUpdateInput,
} from '@tm/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const anna: User = { id: 'u-anna', name: 'Anna Romanova', initials: 'AR', color: '#6D4FC2' };
export const max: User = { id: 'u-max', name: 'Max Kim', initials: 'MK', color: '#2F7D6D' };
export const dev: Team = { id: 't-dev', name: 'Engineering', key: 'DEV', color: '#2F7D6D' };
export const des: Team = { id: 't-des', name: 'Design', key: 'DES', color: '#B5582F' };
export const bug: Label = { id: 'l-bug', teamId: dev.id, name: 'Bug', color: '#EB5757' };
export const feature: Label = { id: 'l-feat', teamId: dev.id, name: 'Feature', color: '#A78BFA' };
export const mobile: Project = {
  id: 'p-mobile',
  teamId: dev.id,
  name: 'Mobile app 2.0',
  createdAt: '2026-09-01T09:00:00.000Z',
  issueCount: 1,
  doneCount: 0,
};
export const cycle14: Cycle = {
  id: 'c-14',
  teamId: dev.id,
  number: 14,
  startsOn: '2026-10-06',
  endsOn: '2026-10-19',
  issueCount: 1,
  doneCount: 0,
};

const users = [anna, max];
const allLabels = [bug, feature];
const STAMP = '2026-10-07T12:00:00.000Z';

function makeIssue(
  n: number,
  title: string,
  status: IssueStatus,
  priority: IssuePriority,
  assignee: User | null,
  labels: Label[] = [],
  extra: Partial<IssueListItem> = {},
): IssueListItem {
  return {
    id: `i-${n}`,
    key: `DEV-${n}`,
    teamId: dev.id,
    number: n,
    title,
    status,
    priority,
    assignee,
    labels,
    projectId: null,
    cycleId: null,
    parentId: null,
    dueDate: null,
    estimate: null,
    sortOrder: n * 1000,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  };
}

interface MockState {
  issues: IssueListItem[];
  descriptions: Record<string, string>;
  comments: CommentDto[];
  activity: ActivityEntry[];
  inbox: Record<string, Omit<InboxItem, 'read'>[]>;
  reads: Set<string>;
  projects: Project[];
  views: View[];
  nextNumber: number;
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  userId: string | null;
}

function freshState(): MockState {
  const issues = [
    makeIssue(1, 'Crash on upload', 'in_progress', 'urgent', anna, [bug], { projectId: mobile.id, cycleId: cycle14.id }),
    makeIssue(2, 'Offline sync', 'in_review', 'high', max, [feature]),
    makeIssue(3, 'Export to CSV', 'todo', 'low', null),
    makeIssue(4, 'Calendar sync', 'backlog', 'none', max),
    makeIssue(5, 'Faster search', 'done', 'medium', anna),
  ];
  const statusEvent: ActivityEntry = {
    id: 'a-status-1',
    issueId: 'i-1',
    type: 'status',
    payload: { from: 'todo', to: 'in_progress' },
    createdAt: '2026-10-07T13:00:00.000Z',
    actor: max,
  };
  return {
    issues,
    descriptions: { 'i-1': 'Uploads over 25 MB crash the app.' },
    comments: [],
    activity: [
      ...issues.map<ActivityEntry>((i) => ({
        id: `a-created-${i.number}`,
        issueId: i.id,
        type: 'created',
        payload: {},
        createdAt: STAMP,
        actor: anna,
      })),
      statusEvent,
    ],
    inbox: {
      [anna.id]: [
        {
          activity: statusEvent,
          issue: { id: 'i-1', key: 'DEV-1', title: 'Crash on upload', status: 'in_progress' },
        },
        {
          activity: {
            id: 'a-prio-5',
            issueId: 'i-5',
            type: 'priority',
            payload: { from: 'low', to: 'medium' },
            createdAt: '2026-10-06T10:00:00.000Z',
            actor: max,
          },
          issue: { id: 'i-5', key: 'DEV-5', title: 'Faster search', status: 'done' },
        },
      ],
    },
    reads: new Set(),
    projects: [mobile],
    views: [],
    nextNumber: 6,
  };
}

export const mock = { state: freshState(), requests: [] as RecordedRequest[] };

export function resetMock() {
  mock.state = freshState();
  mock.requests = [];
}

function record(request: Request, body?: unknown) {
  const url = new URL(request.url);
  mock.requests.push({
    method: request.method,
    path: url.pathname + url.search,
    body,
    userId: request.headers.get('x-user-id'),
  });
}

const notFound = (what: string) =>
  HttpResponse.json({ error: { code: 'not_found', message: `${what} not found` } }, { status: 404 });

export function toDetail(issue: IssueListItem): IssueDetail {
  const s = mock.state;
  const parent = s.issues.find((i) => i.id === issue.parentId);
  return {
    ...issue,
    description: s.descriptions[issue.id] ?? '',
    creator: anna,
    project: issue.projectId === mobile.id ? { id: mobile.id, name: mobile.name } : null,
    cycle:
      issue.cycleId === cycle14.id
        ? { id: cycle14.id, number: 14, startsOn: cycle14.startsOn, endsOn: cycle14.endsOn }
        : null,
    parent: parent ? { id: parent.id, key: parent.key, title: parent.title, status: parent.status } : null,
    children: s.issues.filter((i) => i.parentId === issue.id),
    comments: s.comments.filter((c) => c.issueId === issue.id),
    activity: s.activity.filter((a) => a.issueId === issue.id),
  };
}

function applyMockPatch(issue: IssueListItem, patch: IssueUpdateInput) {
  const { assigneeId, labelIds, description, ...rest } = patch;
  Object.assign(issue, rest);
  if (assigneeId !== undefined) issue.assignee = users.find((u) => u.id === assigneeId) ?? null;
  if (labelIds !== undefined) issue.labels = allLabels.filter((l) => labelIds.includes(l.id));
  if (description !== undefined) mock.state.descriptions[issue.id] = description;
}

export const handlers = [
  http.get('*/api/users', () => HttpResponse.json(users)),
  http.get('*/api/teams', () => HttpResponse.json([dev, des])),
  http.get('*/api/labels', ({ request }) => {
    const teamId = new URL(request.url).searchParams.get('teamId');
    return HttpResponse.json(allLabels.filter((l) => !teamId || l.teamId === teamId));
  }),
  http.get('*/api/projects', ({ request }) => {
    const teamId = new URL(request.url).searchParams.get('teamId');
    return HttpResponse.json(mock.state.projects.filter((p) => !teamId || p.teamId === teamId));
  }),
  http.get('*/api/projects/:id', ({ params }) => {
    const project = mock.state.projects.find((p) => p.id === params.id);
    return project ? HttpResponse.json(project) : notFound('Project');
  }),
  http.post('*/api/projects', async ({ request }) => {
    const body = (await request.json()) as { teamId: string; name: string };
    record(request, body);
    const project: Project = {
      id: `p-${mock.state.projects.length + 1}`,
      teamId: body.teamId,
      name: body.name,
      createdAt: STAMP,
      issueCount: 0,
      doneCount: 0,
    };
    mock.state.projects.push(project);
    return HttpResponse.json(project, { status: 201 });
  }),
  http.get('*/api/cycles', () => HttpResponse.json([cycle14])),
  http.get('*/api/cycles/:id', ({ params }) => (params.id === cycle14.id ? HttpResponse.json(cycle14) : notFound('Cycle'))),
  http.get('*/api/issues', ({ request }) => {
    record(request);
    const sp = new URL(request.url).searchParams;
    let list = [...mock.state.issues];
    const teamId = sp.get('teamId');
    if (teamId) list = list.filter((i) => i.teamId === teamId);
    const status = sp.getAll('status');
    if (status.length) list = list.filter((i) => status.includes(i.status));
    const priority = sp.getAll('priority');
    if (priority.length) list = list.filter((i) => priority.includes(i.priority));
    const assignees = sp.getAll('assigneeId');
    if (assignees.length) list = list.filter((i) => i.assignee !== null && assignees.includes(i.assignee.id));
    const labelIds = sp.getAll('labelId');
    if (labelIds.length) list = list.filter((i) => i.labels.some((l) => labelIds.includes(l.id)));
    const projectId = sp.get('projectId');
    if (projectId) list = list.filter((i) => i.projectId === projectId);
    const cycleId = sp.get('cycleId');
    if (cycleId) list = list.filter((i) => i.cycleId === cycleId);
    if (sp.get('mine') === 'true') {
      const userId = request.headers.get('x-user-id');
      list = list.filter((i) => i.assignee?.id === userId);
    }
    return HttpResponse.json(list.sort((a, b) => a.sortOrder - b.sortOrder));
  }),
  http.get('*/api/issues/:key', ({ params }) => {
    const issue = mock.state.issues.find((i) => i.key === String(params.key).toUpperCase());
    return issue ? HttpResponse.json(toDetail(issue)) : notFound('Issue');
  }),
  http.post('*/api/issues', async ({ request }) => {
    const body = (await request.json()) as IssueCreateInput;
    record(request, body);
    const created = makeIssue(
      mock.state.nextNumber++,
      body.title,
      body.status ?? 'todo',
      body.priority ?? 'none',
      users.find((u) => u.id === body.assigneeId) ?? null,
      allLabels.filter((l) => body.labelIds?.includes(l.id)),
      {
        teamId: body.teamId,
        projectId: body.projectId ?? null,
        cycleId: body.cycleId ?? null,
        parentId: body.parentId ?? null,
      },
    );
    mock.state.issues.push(created);
    return HttpResponse.json(toDetail(created), { status: 201 });
  }),
  http.patch('*/api/issues/:id', async ({ request, params }) => {
    const patch = (await request.json()) as IssueUpdateInput;
    record(request, patch);
    const issue = mock.state.issues.find((i) => i.id === params.id);
    if (!issue) return notFound('Issue');
    applyMockPatch(issue, patch);
    return HttpResponse.json(toDetail(issue));
  }),
  http.delete('*/api/issues/:id', ({ request, params }) => {
    record(request);
    mock.state.issues = mock.state.issues.filter((i) => i.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/issues/:id/comments', async ({ request, params }) => {
    const { body } = (await request.json()) as { body: string };
    record(request, { body });
    const author = users.find((u) => u.id === request.headers.get('x-user-id')) ?? anna;
    const comment: CommentDto = {
      id: `c-${mock.state.comments.length + 1}`,
      issueId: String(params.id),
      author,
      body,
      createdAt: new Date().toISOString(),
    };
    mock.state.comments.push(comment);
    return HttpResponse.json(comment, { status: 201 });
  }),
  http.get('*/api/inbox', ({ request }) => {
    const items = (mock.state.inbox[request.headers.get('x-user-id') ?? ''] ?? []).map((item) => ({
      ...item,
      read: mock.state.reads.has(item.activity.id),
    }));
    return HttpResponse.json({ items, unreadCount: items.filter((i) => !i.read).length });
  }),
  http.post('*/api/inbox/read', async ({ request }) => {
    const body = (await request.json()) as InboxReadInput;
    record(request, body);
    const items = mock.state.inbox[request.headers.get('x-user-id') ?? ''] ?? [];
    const ids = 'all' in body ? items.map((i) => i.activity.id) : body.activityIds;
    ids.forEach((id) => mock.state.reads.add(id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/views', () => HttpResponse.json(mock.state.views)),
  http.get('*/api/views/:id', ({ params }) => {
    const view = mock.state.views.find((v) => v.id === params.id);
    return view ? HttpResponse.json(view) : notFound('View');
  }),
  http.post('*/api/views', async ({ request }) => {
    const body = (await request.json()) as ViewCreateInput;
    record(request, body);
    const view: View = {
      id: `v-${mock.state.views.length + 1}`,
      name: body.name,
      filters: body.filters ?? {},
      createdAt: STAMP,
    };
    mock.state.views.push(view);
    return HttpResponse.json(view, { status: 201 });
  }),
  http.patch('*/api/views/:id', async ({ request, params }) => {
    const body = (await request.json()) as ViewUpdateInput;
    record(request, body);
    const view = mock.state.views.find((v) => v.id === params.id);
    if (!view) return notFound('View');
    if (body.name !== undefined) view.name = body.name;
    if (body.filters !== undefined) view.filters = body.filters;
    return HttpResponse.json(view);
  }),
  http.delete('*/api/views/:id', ({ request, params }) => {
    record(request);
    mock.state.views = mock.state.views.filter((v) => v.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

export const server = setupServer(...handlers);
```

`apps/web/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMock, server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMock();
  localStorage.clear();
});
afterAll(() => server.close());
```

`apps/web/src/test/render.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AppProviders, AppRoutes } from '../App';

function setup(children: ReactNode, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AppProviders>{children}</AppProviders>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, user, queryClient };
}

/** Renders the whole app (sidebar + routed page) at the given route. */
export function renderApp(route = '/') {
  return setup(<AppRoutes />, route);
}

/** Renders a single element inside all app providers. */
export function renderWithProviders(ui: ReactElement, route = '/') {
  return setup(ui, route);
}
```

- [ ] **Step 3: Write the failing tests**

`apps/web/src/api/client.test.ts`:
```ts
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { ApiError, api, setApiUser, toQuery } from './client';

afterEach(() => setApiUser(null));

describe('toQuery', () => {
  it('repeats array values and skips empty ones', () => {
    expect(toQuery({ teamId: 't1', status: ['todo', 'done'], mine: false, cycleId: undefined })).toBe(
      '?teamId=t1&status=todo&status=done',
    );
    expect(toQuery({ mine: true })).toBe('?mine=true');
    expect(toQuery({})).toBe('');
  });
});

describe('api client', () => {
  it('sends the current user header', async () => {
    let header: string | null = null;
    server.use(
      http.get('*/api/inbox', ({ request }) => {
        header = request.headers.get('x-user-id');
        return HttpResponse.json({ items: [], unreadCount: 0 });
      }),
    );
    setApiUser('u-anna');
    await api.inbox();
    expect(header).toBe('u-anna');
  });

  it('turns error bodies into ApiError', async () => {
    server.use(
      http.get('*/api/issues/:key', () =>
        HttpResponse.json({ error: { code: 'not_found', message: 'Issue not found' } }, { status: 404 }),
      ),
    );
    const error = await api.issue('DEV-999').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'Issue not found' });
  });
});
```

`apps/web/src/components/Sidebar.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';

describe('Sidebar', () => {
  it('shows the first team expanded and the inbox unread count', async () => {
    renderApp('/nowhere');
    expect(await screen.findByRole('button', { name: 'Engineering' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Issues' })).toHaveAttribute('href', '/team/DEV/issues');
    expect(screen.getByRole('link', { name: 'Cycles' })).toHaveAttribute('href', '/team/DEV/cycles');
    expect(await screen.findByLabelText('2 unread')).toBeInTheDocument();
  });

  it('expands another team', async () => {
    const { user } = renderApp('/nowhere');
    await user.click(await screen.findByRole('button', { name: 'Design' }));
    const hrefs = screen.getAllByRole('link', { name: 'Issues' }).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/team/DEV/issues', '/team/DES/issues']);
  });

  it("switches the current user, persists the choice and shows that user's inbox", async () => {
    const { user } = renderApp('/nowhere');
    await screen.findByLabelText('2 unread');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Current user' }), 'Max Kim');
    await waitFor(() => expect(screen.queryByLabelText('2 unread')).not.toBeInTheDocument());
    expect(localStorage.getItem('tm.currentUserId')).toBe('u-max');
  });

  it('restores the stored current user', async () => {
    localStorage.setItem('tm.currentUserId', 'u-max');
    renderApp('/nowhere');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Current user' })).toHaveValue('u-max'));
  });

  it('renders a not found page for unknown routes', async () => {
    renderApp('/nowhere');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test`
Expected: FAIL — cannot resolve `./client` / `../App`.

- [ ] **Step 5: Styles**

`apps/web/src/styles/tokens.css`:
```css
:root {
  --bg: #0b0b0d;
  --panel: #121215;
  --panel-border: #222227;
  --divider: #1f1f23;
  --divider-soft: #1a1a1e;
  --surface: #161619;
  --surface-border: #26262b;
  --surface-hover: #17171c;
  --card-hover: #18181c;
  --card-hover-border: #34343b;
  --group-bg: #151519;
  --group-hover: #18181d;
  --nav-hover: #17171b;
  --nav-active: #1c1c21;
  --btn-hover: #1e1e23;
  --chip-active-bg: #222228;
  --chip-active-border: #2e2e34;
  --popover: #1a1a1f;
  --text: #e8e8ec;
  --text-strong: #ffffff;
  --text-muted: #8e8e97;
  --text-body: #d2d2d8;
  --text-label: #c9c9d0;
  --accent: #5e63e6;
  --accent-hover: #6c71ee;
  --status-todo: #b4b4bc;
  --status-progress: #e2b53e;
  --status-review: #4cb782;
  --status-backlog: #8e8e97;
  --priority-urgent: #f2994a;
  --priority-bars: #b4b4bc;
  --danger: #eb5757;
  --font: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
}
```

`apps/web/src/styles/global.css`:
```css
@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body,
#root {
  min-height: 100%;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  color-scheme: dark;
}
a {
  color: var(--text);
  text-decoration: none;
}
a:hover {
  color: var(--text-strong);
}
button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
}
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.muted {
  color: var(--text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.btn {
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
}
.btn svg {
  color: var(--text-muted);
}
.btn:hover:not(:disabled) {
  background: var(--btn-hover);
}
.btn:disabled {
  opacity: 0.5;
}
.btn-primary {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
.icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
}
.icon-btn:hover:not(:disabled) {
  background: var(--btn-hover);
  color: var(--text);
}
.input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
}
.input:focus {
  border-color: var(--accent);
}
```

`apps/web/src/pages/page.module.css`:
```css
.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.content {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.spacer {
  flex: 1;
}
.actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.tabs {
  display: flex;
  gap: 4px;
  margin-left: 8px;
  flex-wrap: wrap;
}
.tab {
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
}
.tab:hover {
  color: var(--text);
}
.tabActive {
  border-color: var(--chip-active-border);
  background: var(--chip-active-bg);
  color: var(--text-strong);
}
```

- [ ] **Step 6: Utilities, API client and query hooks**

`apps/web/src/lib/cx.ts`:
```ts
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

`apps/web/src/lib/storage.ts`:
```ts
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private mode) — the preference just won't persist
    }
  },
};
```

`apps/web/src/api/client.ts`:
```ts
import type {
  ApiErrorBody,
  CommentDto,
  Cycle,
  InboxReadInput,
  InboxResponse,
  IssueCreateInput,
  IssueDetail,
  IssueFilters,
  IssueListItem,
  IssueUpdateInput,
  Label,
  Project,
  ProjectCreateInput,
  Team,
  User,
  View,
  ViewCreateInput,
  ViewUpdateInput,
} from '@tm/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let currentUserId: string | null = null;

export function setApiUser(id: string | null): void {
  currentUserId = id;
}

export function toQuery(params: object): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const query = sp.toString();
  return query ? `?${query}` : '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (currentUserId) headers['x-user-id'] = currentUserId;
  let res: Response;
  try {
    res = await fetch(new URL(`/api${path}`, window.location.origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Network error — is the API running?');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, error?.code ?? 'http_error', error?.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  users: () => request<User[]>('GET', '/users'),
  teams: () => request<Team[]>('GET', '/teams'),
  labels: (teamId?: string) => request<Label[]>('GET', `/labels${toQuery({ teamId })}`),
  projects: (teamId?: string) => request<Project[]>('GET', `/projects${toQuery({ teamId })}`),
  project: (id: string) => request<Project>('GET', `/projects/${id}`),
  createProject: (input: ProjectCreateInput) => request<Project>('POST', '/projects', input),
  cycles: (teamId?: string) => request<Cycle[]>('GET', `/cycles${toQuery({ teamId })}`),
  cycle: (id: string) => request<Cycle>('GET', `/cycles/${id}`),
  issues: (filters: IssueFilters) => request<IssueListItem[]>('GET', `/issues${toQuery(filters)}`),
  issue: (key: string) => request<IssueDetail>('GET', `/issues/${encodeURIComponent(key)}`),
  createIssue: (input: IssueCreateInput) => request<IssueDetail>('POST', '/issues', input),
  updateIssue: (id: string, patch: IssueUpdateInput) => request<IssueDetail>('PATCH', `/issues/${id}`, patch),
  deleteIssue: (id: string) => request<void>('DELETE', `/issues/${id}`),
  addComment: (issueId: string, body: string) =>
    request<CommentDto>('POST', `/issues/${issueId}/comments`, { body }),
  inbox: () => request<InboxResponse>('GET', '/inbox'),
  markRead: (input: InboxReadInput) => request<void>('POST', '/inbox/read', input),
  views: () => request<View[]>('GET', '/views'),
  view: (id: string) => request<View>('GET', `/views/${id}`),
  createView: (input: ViewCreateInput) => request<View>('POST', '/views', input),
  updateView: (id: string, input: ViewUpdateInput) => request<View>('PATCH', `/views/${id}`, input),
  deleteView: (id: string) => request<void>('DELETE', `/views/${id}`),
};
```

`apps/web/src/api/queries.ts`:
```ts
import type { IssueFilters } from '@tm/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export const qk = {
  users: ['users'] as const,
  teams: ['teams'] as const,
  labels: (teamId?: string) => ['labels', teamId ?? 'all'] as const,
  projects: (teamId?: string) => ['projects', teamId ?? 'all'] as const,
  project: (id: string) => ['project', id] as const,
  cycles: (teamId?: string) => ['cycles', teamId ?? 'all'] as const,
  cycle: (id: string) => ['cycle', id] as const,
  issues: (filters: IssueFilters, scope = '') => ['issues', filters, scope] as const,
  issue: (key: string) => ['issue', key.toUpperCase()] as const,
  inbox: (userId: string | null) => ['inbox', userId] as const,
  views: ['views'] as const,
  view: (id: string) => ['view', id] as const,
};

export const useUsers = () => useQuery({ queryKey: qk.users, queryFn: api.users, staleTime: 60_000 });

export const useTeams = () => useQuery({ queryKey: qk.teams, queryFn: api.teams, staleTime: 60_000 });

export function useTeamByKey(key: string) {
  const query = useTeams();
  return { team: query.data?.find((t) => t.key === key.toUpperCase()), isLoading: query.isPending };
}

export const useLabels = (teamId?: string) =>
  useQuery({ queryKey: qk.labels(teamId), queryFn: () => api.labels(teamId), staleTime: 60_000 });

export const useProjects = (teamId?: string) =>
  useQuery({ queryKey: qk.projects(teamId), queryFn: () => api.projects(teamId) });

export const useProject = (id: string) => useQuery({ queryKey: qk.project(id), queryFn: () => api.project(id) });

export const useCycles = (teamId?: string) =>
  useQuery({ queryKey: qk.cycles(teamId), queryFn: () => api.cycles(teamId) });

export const useCycle = (id: string) => useQuery({ queryKey: qk.cycle(id), queryFn: () => api.cycle(id) });

export function useIssues(filters: IssueFilters, options: { scope?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.issues(filters, options.scope),
    queryFn: () => api.issues(filters),
    enabled: options.enabled ?? true,
  });
}

export const useIssue = (key: string) => useQuery({ queryKey: qk.issue(key), queryFn: () => api.issue(key) });

/** Pass the current user's id: the inbox is per user and must refetch when the user switches. */
export function useInbox(userId: string | null) {
  return useQuery({ queryKey: qk.inbox(userId), queryFn: api.inbox, enabled: !!userId });
}

export const useViews = () => useQuery({ queryKey: qk.views, queryFn: api.views });

export const useView = (id: string) => useQuery({ queryKey: qk.view(id), queryFn: () => api.view(id) });
```

- [ ] **Step 7: Current user and toasts**

`apps/web/src/lib/currentUser.tsx`:
```tsx
import type { User } from '@tm/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { setApiUser } from '../api/client';
import { useUsers } from '../api/queries';
import { storage } from './storage';

const STORAGE_KEY = 'tm.currentUserId';

interface CurrentUserValue {
  user: User | null;
  users: User[];
  setUserId: (id: string) => void;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { data: users } = useUsers();
  const [userId, setUserIdState] = useState<string | null>(() => storage.get(STORAGE_KEY));
  const list = useMemo(() => users ?? [], [users]);
  const user = list.find((u) => u.id === userId) ?? list[0] ?? null;
  // Set synchronously so requests fired by children during this render cycle carry the header.
  setApiUser(user?.id ?? null);

  const value = useMemo<CurrentUserValue>(
    () => ({
      user,
      users: list,
      setUserId: (id) => {
        storage.set(STORAGE_KEY, id);
        setUserIdState(id);
      },
    }),
    [user, list],
  );
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return value;
}
```

`apps/web/src/lib/toast.module.css`:
```css
.stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  max-width: 360px;
  padding: 10px 14px;
  background: var(--popover);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.error {
  border-color: var(--danger);
}
```

`apps/web/src/lib/toast.tsx`:
```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cx } from './cx';
import styles from './toast.module.css';

type Tone = 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastValue {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++seq;
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx(styles.toast, t.tone === 'error' && styles.error)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
```

- [ ] **Step 8: Icons, primitives and states**

`apps/web/src/components/icons.tsx`:
```tsx
import { PRIORITY_LABELS, STATUS_LABELS, type IssuePriority, type IssueStatus } from '@tm/shared';
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function icon(size: number, children: ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const SearchIcon = icon(16, <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L13.5 13.5" /></>);
export const PencilIcon = icon(16, <path d="M11 2.5l2.5 2.5L7 11.5H4.5V9z" />);
export const InboxIcon = icon(16, <><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" /></>);
export const MyIssuesIcon = icon(16, <><circle cx="8" cy="8" r="5.5" /><path d="M5.8 8.2l1.5 1.5 3-3" /></>);
export const ProjectIcon = icon(14, <path d="M8 2l5.5 3v6L8 14l-5.5-3V5z" />);
export const ViewsIcon = icon(
  16,
  <>
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
  </>,
);
export const PlusIcon = icon(14, <path d="M8 3v10M3 8h10" />);
export const ChevronIcon = icon(12, <path d="M6 4l4 4-4 4" />);
export const FilterIcon = icon(14, <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />);
export const ListIcon = icon(14, <path d="M3 4h10M3 8h10M3 12h10" />);
export const BoardIcon = icon(14, <><rect x="2.5" y="2.5" width="4" height="11" rx="1" /><rect x="9.5" y="2.5" width="4" height="7" rx="1" /></>);
export const DisplayIcon = icon(
  14,
  <>
    <path d="M3 5h10M3 11h10" />
    <circle cx="6" cy="5" r="1.5" style={{ fill: 'var(--panel)' }} />
    <circle cx="10" cy="11" r="1.5" style={{ fill: 'var(--panel)' }} />
  </>,
);
export const CheckIcon = icon(14, <path d="M3.5 8.5l3 3 6-7" />);
export const TrashIcon = icon(14, <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />);
export const CloseIcon = icon(14, <path d="M4 4l8 8M12 4l-8 8" />);

export function StatusIcon({ status, size = 14 }: { status: IssueStatus; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 14 14', role: 'img', 'aria-label': STATUS_LABELS[status] };
  switch (status) {
    case 'backlog':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" strokeDasharray="2 2" style={{ stroke: 'var(--status-backlog)' }} />
        </svg>
      );
    case 'todo':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" style={{ stroke: 'var(--status-todo)' }} />
        </svg>
      );
    case 'in_progress':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" style={{ stroke: 'var(--status-progress)' }} />
          <path d="M7 3.5 A3.5 3.5 0 0 1 7 10.5 Z" style={{ fill: 'var(--status-progress)' }} />
        </svg>
      );
    case 'in_review':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" style={{ stroke: 'var(--status-review)' }} />
          <path d="M7 3.5 A3.5 3.5 0 1 1 3.5 7 L7 7 Z" style={{ fill: 'var(--status-review)' }} />
        </svg>
      );
    case 'done':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.5" style={{ fill: 'var(--accent)' }} />
          <path d="M4.4 7.2 L6.2 9 L9.6 5.4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function PriorityIcon({ priority, size = 14 }: { priority: IssuePriority; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 14 14', role: 'img', 'aria-label': PRIORITY_LABELS[priority] };
  if (priority === 'urgent') {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="12" height="12" rx="3" style={{ fill: 'var(--priority-urgent)' }} />
        <rect x="6.25" y="3.4" width="1.5" height="4.6" rx="0.5" style={{ fill: 'var(--panel)' }} />
        <rect x="6.25" y="9.2" width="1.5" height="1.5" rx="0.5" style={{ fill: 'var(--panel)' }} />
      </svg>
    );
  }
  if (priority === 'none') {
    return (
      <svg {...common}>
        <rect x="1.5" y="6.25" width="2.5" height="1.5" rx="0.75" style={{ fill: 'var(--text-muted)' }} />
        <rect x="5.75" y="6.25" width="2.5" height="1.5" rx="0.75" style={{ fill: 'var(--text-muted)' }} />
        <rect x="10" y="6.25" width="2.5" height="1.5" rx="0.75" style={{ fill: 'var(--text-muted)' }} />
      </svg>
    );
  }
  const middle = priority === 'low' ? 0.3 : 1;
  const top = priority === 'high' ? 1 : 0.3;
  return (
    <svg {...common}>
      <rect x="1.5" y="8" width="3" height="4.5" rx="1" style={{ fill: 'var(--priority-bars)' }} />
      <rect x="5.5" y="5" width="3" height="7.5" rx="1" opacity={middle} style={{ fill: 'var(--priority-bars)' }} />
      <rect x="9.5" y="2" width="3" height="10.5" rx="1" opacity={top} style={{ fill: 'var(--priority-bars)' }} />
    </svg>
  );
}
```

`apps/web/src/components/primitives.module.css`:
```css
.avatar {
  flex: none;
  border-radius: 50%;
  color: #fff;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.noAvatar {
  flex: none;
  border-radius: 50%;
  border: 1.5px dashed var(--text-muted);
  display: inline-block;
}
.chip {
  height: 22px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--surface-border);
  border-radius: 11px;
  font-size: 12px;
  color: var(--text-label);
  white-space: nowrap;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 4px;
}
.team {
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 4px;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.crumb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.track {
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: var(--surface-border);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: var(--accent);
}
```

`apps/web/src/components/primitives.tsx`:
```tsx
import type { Label, Team, User } from '@tm/shared';
import styles from './primitives.module.css';

export function Avatar({ user, size = 22 }: { user: User | null; size?: number }) {
  if (!user) {
    return <span className={styles.noAvatar} style={{ width: size, height: size }} aria-label="No assignee" role="img" />;
  }
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, background: user.color, fontSize: Math.round(size * 0.45) }}
      title={user.name}
      aria-hidden="true"
    >
      {user.initials}
    </span>
  );
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className={styles.chip}>
      <span className={styles.dot} style={{ background: label.color }} />
      {label.name}
    </span>
  );
}

export function TeamBadge({ team }: { team: Team }) {
  return (
    <span className={styles.team} style={{ background: team.color }} aria-hidden="true">
      {team.name.charAt(0)}
    </span>
  );
}

export function TeamCrumb({ team }: { team: Team }) {
  return (
    <span className={styles.crumb}>
      <TeamBadge team={team} />
      {team.name}
    </span>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className={styles.progress} aria-label={`${done} of ${total} done`}>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </span>
      <span className="muted">
        {done}/{total}
      </span>
    </span>
  );
}
```

`apps/web/src/components/states.module.css`:
```css
.empty {
  padding: 64px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.title {
  font-size: 14px;
  font-weight: 500;
}
.description {
  margin: 0;
  max-width: 360px;
  color: var(--text-muted);
}
.skeleton {
  display: flex;
  flex-direction: column;
}
.skeletonRow {
  height: 44px;
  border-bottom: 1px solid var(--divider-soft);
  display: flex;
  align-items: center;
  padding: 0 16px;
}
.bar {
  height: 10px;
  width: 40%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--surface) 0%, var(--btn-hover) 50%, var(--surface) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
```

`apps/web/src/components/states.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './states.module.css';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <div className={styles.title}>{title}</div>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      description={error.message}
      action={
        onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Retry
          </button>
        )
      }
    />
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <span className={styles.bar} style={{ width: `${30 + ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Layout, page header, sidebar, not-found page, app routes**

`apps/web/src/components/PageHeader.module.css`:
```css
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 49px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--divider);
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  min-width: 0;
}
.crumb {
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.current {
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.sep {
  color: var(--text-muted);
  flex: none;
}
```

`apps/web/src/components/PageHeader.tsx`:
```tsx
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronIcon } from './icons';
import styles from './PageHeader.module.css';

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export function PageHeader({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="Breadcrumbs">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronIcon className={styles.sep} />}
              {crumb.to ? (
                <Link to={crumb.to} className={styles.crumb}>
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? styles.current : styles.crumb}>{crumb.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>
      {children}
    </header>
  );
}
```

`apps/web/src/components/AppLayout.module.css`:
```css
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.panel {
  flex: 1;
  min-width: 0;
  margin: 8px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@media (min-width: 800px) {
  .shell {
    flex-direction: row;
    height: 100vh;
  }
  .panel {
    height: calc(100vh - 16px);
  }
}
```

`apps/web/src/components/AppLayout.tsx`:
```tsx
import { Outlet } from 'react-router';
import styles from './AppLayout.module.css';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.panel}>
        <Outlet />
      </main>
    </div>
  );
}
```

`apps/web/src/components/Sidebar.module.css`:
```css
.sidebar {
  width: 100%;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
@media (min-width: 800px) {
  .sidebar {
    width: 232px;
    flex: none;
    overflow-y: auto;
  }
}
.workspace {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
}
.logo {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
}
.workspaceName {
  flex: 1;
  font-weight: 600;
}
.newIssue {
  width: 28px;
  height: 28px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: #141417;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.newIssue:hover {
  background: var(--btn-hover);
}
.group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.heading {
  padding: 0 8px 4px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.item {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.item svg {
  color: var(--text-muted);
  flex: none;
}
.item:hover:not(:disabled) {
  background: var(--nav-hover);
  color: var(--text);
}
.item:disabled {
  color: var(--text-muted);
}
.active,
.active:hover {
  background: var(--nav-active);
  color: var(--text-strong);
}
.label {
  flex: 1;
}
.count {
  font-size: 11px;
  color: var(--text-muted);
}
.team {
  composes: item;
  font-weight: 500;
}
.chevron {
  transition: transform 0.15s;
}
.chevronOpen {
  composes: chevron;
  transform: rotate(90deg);
}
.sub {
  composes: item;
  padding-left: 34px;
}
.footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.userSwitch {
  height: 30px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.userSelect {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
}
.userSelect option {
  background: var(--panel);
}
```

`apps/web/src/components/Sidebar.tsx`:
```tsx
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useInbox, useTeams } from '../api/queries';
import { useCurrentUser } from '../lib/currentUser';
import { cx } from '../lib/cx';
import { ChevronIcon, InboxIcon, MyIssuesIcon, PencilIcon, PlusIcon, ProjectIcon, SearchIcon, ViewsIcon } from './icons';
import { Avatar, TeamBadge } from './primitives';
import styles from './Sidebar.module.css';

function NavItem({ to, icon, label, count }: { to: string; icon: ReactNode; label: string; count?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) => cx(styles.item, isActive && styles.active)}>
      {icon}
      <span className={styles.label}>{label}</span>
      {!!count && (
        <span className={styles.count} aria-label={`${count} unread`}>
          {count}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar({ onNewIssue }: { onNewIssue?: () => void }) {
  const { data: teams = [] } = useTeams();
  const { user, users, setUserId } = useCurrentUser();
  const { data: inbox } = useInbox(user?.id ?? null);
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.workspace}>
        <span className={styles.logo} aria-hidden="true">
          M
        </span>
        <span className={styles.workspaceName}>My workspace</span>
        <button type="button" className="icon-btn" aria-label="Search" title="Search is coming soon" disabled>
          <SearchIcon />
        </button>
        <button type="button" className={styles.newIssue} aria-label="New issue" onClick={onNewIssue}>
          <PencilIcon />
        </button>
      </div>

      <div className={styles.group}>
        <NavItem to="/inbox" icon={<InboxIcon />} label="Inbox" count={inbox?.unreadCount} />
        <NavItem to="/my-issues" icon={<MyIssuesIcon />} label="My issues" />
      </div>

      <div className={styles.group}>
        <div className={styles.heading}>Workspace</div>
        <NavItem to="/projects" icon={<ProjectIcon width={16} height={16} />} label="Projects" />
        <NavItem to="/views" icon={<ViewsIcon />} label="Views" />
      </div>

      <div className={styles.group}>
        <div className={styles.heading}>Your teams</div>
        {teams.map((team, index) => {
          const open = expanded[team.id] ?? index === 0;
          const base = `/team/${team.key}`;
          const issuesActive = pathname.startsWith(`${base}/issues`) || pathname.startsWith(`${base}/board`);
          return (
            <div key={team.id} className={styles.group}>
              <button
                type="button"
                className={styles.team}
                aria-expanded={open}
                onClick={() => setExpanded((e) => ({ ...e, [team.id]: !open }))}
              >
                <TeamBadge team={team} />
                <span className={styles.label}>{team.name}</span>
                <ChevronIcon className={open ? styles.chevronOpen : styles.chevron} />
              </button>
              {open && (
                <>
                  <NavLink to={`${base}/issues`} className={cx(styles.sub, issuesActive && styles.active)}>
                    Issues
                  </NavLink>
                  <NavLink to={`${base}/cycles`} className={({ isActive }) => cx(styles.sub, isActive && styles.active)}>
                    Cycles
                  </NavLink>
                  <NavLink to={`/projects?teamId=${team.id}`} className={styles.sub}>
                    Projects
                  </NavLink>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.item} disabled title="Invites need accounts, which are not enabled yet">
          <PlusIcon />
          <span className={styles.label}>Invite people</span>
        </button>
        <div className={styles.userSwitch}>
          <Avatar user={user} size={18} />
          <select
            className={styles.userSelect}
            aria-label="Current user"
            value={user?.id ?? ''}
            onChange={(e) => setUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}
```

`apps/web/src/pages/NotFound.tsx`:
```tsx
import { Link } from 'react-router';
import { EmptyState } from '../components/states';

export function NotFound({ title = 'Page not found' }: { title?: string }) {
  return (
    <EmptyState
      title={title}
      description="It may have been deleted, or the link is wrong."
      action={
        <Link className="btn" to="/">
          Go to issues
        </Link>
      }
    />
  );
}
```

`apps/web/src/App.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useTeams } from './api/queries';
import { AppLayout } from './components/AppLayout';
import { EmptyState, ListSkeleton } from './components/states';
import { CurrentUserProvider } from './lib/currentUser';
import { ToastProvider } from './lib/toast';
import { NotFound } from './pages/NotFound';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CurrentUserProvider>{children}</CurrentUserProvider>
    </ToastProvider>
  );
}

function HomeRedirect() {
  const { data: teams, isPending } = useTeams();
  if (isPending) return <ListSkeleton />;
  const first = teams?.[0];
  return first ? <Navigate to={`/team/${first.key}/issues`} replace /> : <EmptyState title="No teams yet" />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ApiError } from './api/client';
import { AppProviders, AppRoutes } from './App';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 10: Run tests and typecheck**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: client and Sidebar tests PASS, typecheck exits 0.

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): app shell with sidebar, current user switcher and MSW test backend"
```

---

### Task 9: Pure UI logic — formatting, filters, activity text, optimistic patch, board moves

**Files:**
- Create: `apps/web/src/lib/format.ts`, `filters.ts`, `activityText.ts`, `applyPatch.ts`, `boardMove.ts`
- Test: `apps/web/src/lib/format.test.ts`, `filters.test.ts`, `activityText.test.ts`, `applyPatch.test.ts`, `boardMove.test.ts`

**Interfaces:**
- Consumes: shared constants and DTO types; activity payload shapes from Task 5.
- Produces:
  - `formatShortDate(value: string): string` ('Oct 7'; date-only strings are formatted in UTC), `formatRange(start, end): string` ('Oct 6–19', 'Sep 29–Oct 12'), `formatEstimate(n: number | null): string` ('No estimate' / '1 point' / '5 points'), `cycleName(c): string` ('Cycle 14 · Oct 6–19')
  - `type FilterFields = Omit<ViewFilters, 'teamId'>`, `filtersFromSearch(sp): FilterFields`, `applyFiltersToSearch(sp, f): URLSearchParams`, `countFilters(f): number`, `stripTeam(f: ViewFilters): FilterFields`
  - `describeActivity(a: Pick<ActivityEntry, 'type' | 'payload'>): string`
  - `applyPatch<T extends IssueListItem>(issue: T, patch: IssueUpdateInput, ctx: { users: User[]; labels: Label[] }): T`
  - `type Columns = Record<IssueStatus, IssueListItem[]>`, `columnId(status): string` (`column:<status>`), `groupByStatus(issues): Columns`, `sortOrderBetween(prev?, next?): number`, `planMove(columns, activeId, overId): { status; sortOrder } | null`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cycleName, formatEstimate, formatRange, formatShortDate } from './format';

describe('format', () => {
  it('formats date-only values without timezone drift', () => {
    expect(formatShortDate('2026-10-17')).toBe('Oct 17');
    expect(formatShortDate('2026-01-01')).toBe('Jan 1');
  });

  it('formats timestamps', () => {
    expect(formatShortDate('2026-10-07T12:00:00.000Z')).toBe('Oct 7');
  });

  it('formats ranges within and across months', () => {
    expect(formatRange('2026-10-06', '2026-10-19')).toBe('Oct 6–19');
    expect(formatRange('2026-09-29', '2026-10-12')).toBe('Sep 29–Oct 12');
  });

  it('formats estimates', () => {
    expect(formatEstimate(null)).toBe('No estimate');
    expect(formatEstimate(1)).toBe('1 point');
    expect(formatEstimate(5)).toBe('5 points');
  });

  it('names cycles', () => {
    expect(cycleName({ number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' })).toBe('Cycle 14 · Oct 6–19');
  });
});
```

`apps/web/src/lib/filters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyFiltersToSearch, countFilters, filtersFromSearch, stripTeam } from './filters';

describe('filters', () => {
  it('reads filters from the URL', () => {
    const sp = new URLSearchParams('tab=active&status=todo&status=done&assigneeId=u1&projectId=p1');
    expect(filtersFromSearch(sp)).toEqual({ status: ['todo', 'done'], assigneeId: ['u1'], projectId: 'p1' });
  });

  it('writes filters while keeping unrelated params', () => {
    const sp = new URLSearchParams('tab=active&status=todo');
    const next = applyFiltersToSearch(sp, { priority: ['high'], cycleId: 'c1' });
    expect(next.toString()).toBe('tab=active&priority=high&cycleId=c1');
  });

  it('drops empty filters', () => {
    expect(applyFiltersToSearch(new URLSearchParams('status=todo'), { status: [] }).toString()).toBe('');
  });

  it('counts active filter groups', () => {
    expect(countFilters({})).toBe(0);
    expect(countFilters({ status: ['todo', 'done'], labelId: ['l1'], projectId: 'p1', priority: [] })).toBe(3);
  });

  it('strips the team from view filters', () => {
    expect(stripTeam({ teamId: 't1', status: ['todo'] })).toEqual({ status: ['todo'] });
  });
});
```

`apps/web/src/lib/activityText.test.ts`:
```ts
import type { ActivityEntry } from '@tm/shared';
import { describe, expect, it } from 'vitest';
import { describeActivity } from './activityText';

const d = (type: ActivityEntry['type'], payload: Record<string, unknown> = {}) => describeActivity({ type, payload });

describe('describeActivity', () => {
  it('describes changes', () => {
    expect(d('created')).toBe('created the issue');
    expect(d('status', { from: 'todo', to: 'in_progress' })).toBe('moved to In Progress');
    expect(d('priority', { from: 'none', to: 'high' })).toBe('set priority to High');
    expect(d('assignee', { from: null, to: 'Anna Romanova' })).toBe('assigned to Anna Romanova');
    expect(d('title', { from: 'A', to: 'B' })).toBe('renamed the issue to “B”');
    expect(d('project', { from: null, to: 'Mobile app 2.0' })).toBe('moved to project Mobile app 2.0');
    expect(d('cycle', { from: null, to: 'Cycle 14' })).toBe('added to Cycle 14');
    expect(d('due_date', { from: null, to: '2026-10-17' })).toBe('set due date to Oct 17');
    expect(d('estimate', { from: null, to: 5 })).toBe('set estimate to 5 points');
    expect(d('parent', { from: null, to: 'DEV-142' })).toBe('made this a sub-issue of DEV-142');
    expect(d('comment', { commentId: 'c1' })).toBe('commented');
  });

  it('describes removals', () => {
    expect(d('priority', { from: 'high', to: 'none' })).toBe('removed the priority');
    expect(d('assignee', { from: 'Anna Romanova', to: null })).toBe('removed the assignee');
    expect(d('project', { from: 'Mobile app 2.0', to: null })).toBe('removed the project');
    expect(d('cycle', { from: 'Cycle 14', to: null })).toBe('removed the cycle');
    expect(d('due_date', { from: '2026-10-17', to: null })).toBe('removed the due date');
    expect(d('estimate', { from: 3, to: null })).toBe('removed the estimate');
    expect(d('parent', { from: 'DEV-1', to: null })).toBe('removed the parent issue');
  });

  it('describes label changes', () => {
    expect(d('labels', { added: ['Bug'], removed: [] })).toBe('added label Bug');
    expect(d('labels', { added: ['Bug', 'Infra'], removed: ['Docs'] })).toBe('added labels Bug, Infra and removed label Docs');
  });
});
```

`apps/web/src/lib/applyPatch.test.ts`:
```ts
import type { IssueListItem, Label, User } from '@tm/shared';
import { describe, expect, it } from 'vitest';
import { applyPatch } from './applyPatch';

const anna: User = { id: 'u1', name: 'Anna', initials: 'AN', color: '#000' };
const bug: Label = { id: 'l1', teamId: 't', name: 'Bug', color: '#f00' };
const base: IssueListItem = {
  id: 'i1',
  key: 'DEV-1',
  teamId: 't',
  number: 1,
  title: 'A',
  status: 'todo',
  priority: 'none',
  assignee: anna,
  labels: [],
  projectId: null,
  cycleId: null,
  parentId: null,
  dueDate: null,
  estimate: null,
  sortOrder: 1000,
  createdAt: '',
  updatedAt: '',
};
const ctx = { users: [anna], labels: [bug] };

describe('applyPatch', () => {
  it('applies scalar fields without mutating the input', () => {
    const next = applyPatch(base, { status: 'done', priority: 'high', sortOrder: 1500, estimate: 3 }, ctx);
    expect(next).toMatchObject({ status: 'done', priority: 'high', sortOrder: 1500, estimate: 3 });
    expect(base.status).toBe('todo');
  });

  it('resolves assignee and labels from the cache', () => {
    expect(applyPatch(base, { assigneeId: null }, ctx).assignee).toBeNull();
    expect(applyPatch({ ...base, assignee: null }, { assigneeId: 'u1' }, ctx).assignee).toEqual(anna);
    expect(applyPatch(base, { labelIds: ['l1', 'missing'] }, ctx).labels).toEqual([bug]);
  });

  it('updates the description of detail objects', () => {
    const detail = { ...base, description: 'old' };
    expect(applyPatch(detail, { description: 'new' }, ctx).description).toBe('new');
  });
});
```

`apps/web/src/lib/boardMove.test.ts`:
```ts
import type { IssueListItem, IssueStatus } from '@tm/shared';
import { describe, expect, it } from 'vitest';
import { columnId, groupByStatus, planMove, sortOrderBetween } from './boardMove';

const item = (id: string, status: IssueStatus, sortOrder: number) => ({ id, status, sortOrder }) as IssueListItem;

const columns = () =>
  groupByStatus([
    item('a', 'todo', 1000),
    item('b', 'todo', 2000),
    item('c', 'todo', 3000),
    item('x', 'in_progress', 1000),
    item('y', 'in_progress', 2000),
  ]);

describe('sortOrderBetween', () => {
  it('handles every neighbour combination', () => {
    expect(sortOrderBetween(undefined, undefined)).toBe(1000);
    expect(sortOrderBetween(undefined, 1000)).toBe(0);
    expect(sortOrderBetween(3000, undefined)).toBe(4000);
    expect(sortOrderBetween(1000, 2000)).toBe(1500);
  });
});

describe('groupByStatus', () => {
  it('creates every column sorted by sortOrder', () => {
    const cols = groupByStatus([item('b', 'todo', 2000), item('a', 'todo', 1000)]);
    expect(cols.todo.map((i) => i.id)).toEqual(['a', 'b']);
    expect(cols.done).toEqual([]);
  });
});

describe('planMove', () => {
  it('moves into an empty column', () => {
    expect(planMove(columns(), 'a', columnId('done'))).toEqual({ status: 'done', sortOrder: 1000 });
  });

  it('appends when dropped on a column', () => {
    expect(planMove(columns(), 'a', columnId('in_progress'))).toEqual({ status: 'in_progress', sortOrder: 3000 });
  });

  it('inserts before the card it is dropped on in another column', () => {
    expect(planMove(columns(), 'a', 'y')).toEqual({ status: 'in_progress', sortOrder: 1500 });
    expect(planMove(columns(), 'c', 'x')).toEqual({ status: 'in_progress', sortOrder: 0 });
  });

  it('places the card after the target when moving down within a column', () => {
    expect(planMove(columns(), 'a', 'b')).toEqual({ status: 'todo', sortOrder: 2500 });
    expect(planMove(columns(), 'a', 'c')).toEqual({ status: 'todo', sortOrder: 4000 });
  });

  it('places the card before the target when moving up within a column', () => {
    expect(planMove(columns(), 'c', 'a')).toEqual({ status: 'todo', sortOrder: 0 });
    expect(planMove(columns(), 'c', 'b')).toEqual({ status: 'todo', sortOrder: 1500 });
  });

  it('ignores no-op drops', () => {
    expect(planMove(columns(), 'a', 'a')).toBeNull();
    expect(planMove(columns(), 'c', columnId('todo'))).toBeNull();
    expect(planMove(columns(), 'missing', 'a')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test src/lib`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/format.ts`:
```ts
const local = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const utc = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatShortDate(value: string): string {
  return DATE_ONLY.test(value) ? utc.format(new Date(`${value}T00:00:00Z`)) : local.format(new Date(value));
}

export function formatRange(start: string, end: string): string {
  const from = formatShortDate(start);
  const to = formatShortDate(end);
  const [fromMonth] = from.split(' ');
  const [toMonth, toDay] = to.split(' ');
  return fromMonth === toMonth ? `${from}–${toDay}` : `${from}–${to}`;
}

export function formatEstimate(points: number | null): string {
  if (points === null) return 'No estimate';
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

export function cycleName(cycle: { number: number; startsOn: string; endsOn: string }): string {
  return `Cycle ${cycle.number} · ${formatRange(cycle.startsOn, cycle.endsOn)}`;
}
```

`apps/web/src/lib/filters.ts`:
```ts
import type { IssuePriority, IssueStatus, ViewFilters } from '@tm/shared';

export type FilterFields = Omit<ViewFilters, 'teamId'>;

const ARRAY_KEYS = ['status', 'priority', 'assigneeId', 'labelId'] as const;
const SINGLE_KEYS = ['projectId', 'cycleId'] as const;

export function filtersFromSearch(sp: URLSearchParams): FilterFields {
  const filters: FilterFields = {};
  const status = sp.getAll('status');
  if (status.length) filters.status = status as IssueStatus[];
  const priority = sp.getAll('priority');
  if (priority.length) filters.priority = priority as IssuePriority[];
  const assigneeId = sp.getAll('assigneeId');
  if (assigneeId.length) filters.assigneeId = assigneeId;
  const labelId = sp.getAll('labelId');
  if (labelId.length) filters.labelId = labelId;
  const projectId = sp.get('projectId');
  if (projectId) filters.projectId = projectId;
  const cycleId = sp.get('cycleId');
  if (cycleId) filters.cycleId = cycleId;
  return filters;
}

export function applyFiltersToSearch(sp: URLSearchParams, filters: FilterFields): URLSearchParams {
  const next = new URLSearchParams(sp);
  for (const key of [...ARRAY_KEYS, ...SINGLE_KEYS]) next.delete(key);
  for (const key of ARRAY_KEYS) for (const value of filters[key] ?? []) next.append(key, value);
  for (const key of SINGLE_KEYS) {
    const value = filters[key];
    if (value) next.set(key, value);
  }
  return next;
}

export function countFilters(filters: FilterFields): number {
  return (
    ARRAY_KEYS.filter((key) => (filters[key]?.length ?? 0) > 0).length +
    SINGLE_KEYS.filter((key) => !!filters[key]).length
  );
}

export function stripTeam(filters: ViewFilters): FilterFields {
  const rest: ViewFilters = { ...filters };
  delete rest.teamId;
  return rest;
}
```

`apps/web/src/lib/activityText.ts`:
```ts
import { PRIORITY_LABELS, STATUS_LABELS, type ActivityEntry, type IssuePriority, type IssueStatus } from '@tm/shared';
import { formatEstimate, formatShortDate } from './format';

interface Payload {
  from?: unknown;
  to?: unknown;
  added?: string[];
  removed?: string[];
}

const plural = (word: string, n: number) => (n === 1 ? word : `${word}s`);

export function describeActivity(entry: Pick<ActivityEntry, 'type' | 'payload'>): string {
  const p = entry.payload as Payload;
  const to = p.to ?? null;
  switch (entry.type) {
    case 'created':
      return 'created the issue';
    case 'status':
      return `moved to ${STATUS_LABELS[to as IssueStatus]}`;
    case 'priority':
      return to === 'none' ? 'removed the priority' : `set priority to ${PRIORITY_LABELS[to as IssuePriority]}`;
    case 'assignee':
      return to ? `assigned to ${String(to)}` : 'removed the assignee';
    case 'title':
      return `renamed the issue to “${String(to)}”`;
    case 'labels': {
      const parts: string[] = [];
      if (p.added?.length) parts.push(`added ${plural('label', p.added.length)} ${p.added.join(', ')}`);
      if (p.removed?.length) parts.push(`removed ${plural('label', p.removed.length)} ${p.removed.join(', ')}`);
      return parts.join(' and ');
    }
    case 'project':
      return to ? `moved to project ${String(to)}` : 'removed the project';
    case 'cycle':
      return to ? `added to ${String(to)}` : 'removed the cycle';
    case 'due_date':
      return to ? `set due date to ${formatShortDate(String(to))}` : 'removed the due date';
    case 'estimate':
      return to === null ? 'removed the estimate' : `set estimate to ${formatEstimate(Number(to))}`;
    case 'parent':
      return to ? `made this a sub-issue of ${String(to)}` : 'removed the parent issue';
    case 'comment':
      return 'commented';
  }
}
```

`apps/web/src/lib/applyPatch.ts`:
```ts
import type { IssueListItem, IssueUpdateInput, Label, User } from '@tm/shared';

export function applyPatch<T extends IssueListItem>(
  issue: T,
  patch: IssueUpdateInput,
  ctx: { users: User[]; labels: Label[] },
): T {
  const { assigneeId, labelIds, description, ...scalars } = patch;
  const next: IssueListItem & { description?: string } = { ...issue, ...scalars };
  if (assigneeId !== undefined) next.assignee = ctx.users.find((u) => u.id === assigneeId) ?? null;
  if (labelIds !== undefined) {
    next.labels = labelIds.map((id) => ctx.labels.find((l) => l.id === id)).filter((l): l is Label => !!l);
  }
  if (description !== undefined && 'description' in next) next.description = description;
  return next as T;
}
```

`apps/web/src/lib/boardMove.ts`:
```ts
import { ISSUE_STATUSES, type IssueListItem, type IssueStatus } from '@tm/shared';

export type Columns = Record<IssueStatus, IssueListItem[]>;

export const columnId = (status: IssueStatus) => `column:${status}`;

export function groupByStatus(issues: IssueListItem[]): Columns {
  const columns = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, [] as IssueListItem[]])) as Columns;
  for (const issue of issues) columns[issue.status].push(issue);
  for (const status of ISSUE_STATUSES) columns[status].sort((a, b) => a.sortOrder - b.sortOrder);
  return columns;
}

export function sortOrderBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return next! - 1000;
  if (next === undefined) return prev + 1000;
  return (prev + next) / 2;
}

export function planMove(
  columns: Columns,
  activeId: string,
  overId: string,
): { status: IssueStatus; sortOrder: number } | null {
  if (activeId === overId) return null;
  const from = ISSUE_STATUSES.find((s) => columns[s].some((i) => i.id === activeId));
  if (!from) return null;
  const overColumn = ISSUE_STATUSES.find((s) => columnId(s) === overId);
  const to = overColumn ?? ISSUE_STATUSES.find((s) => columns[s].some((i) => i.id === overId));
  if (!to) return null;

  const target = columns[to].filter((i) => i.id !== activeId);
  let index: number;
  if (overColumn) {
    index = target.length;
  } else {
    const overIndex = target.findIndex((i) => i.id === overId);
    if (from === to) {
      const activeOriginal = columns[to].findIndex((i) => i.id === activeId);
      const overOriginal = columns[to].findIndex((i) => i.id === overId);
      index = activeOriginal < overOriginal ? overIndex + 1 : overIndex;
    } else {
      index = overIndex;
    }
  }

  if (from === to && index === columns[from].findIndex((i) => i.id === activeId)) return null;
  return { status: to, sortOrder: sortOrderBetween(target[index - 1]?.sortOrder, target[index]?.sortOrder) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test src/lib && pnpm --filter @tm/web typecheck`
Expected: all lib tests PASS, typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): formatting, filter, activity text, optimistic patch and board move helpers"
```

---

### Task 10: Property pickers

**Files:**
- Create: `apps/web/src/lib/useDismiss.ts`
- Create: `apps/web/src/components/PropertyPicker.tsx`, `PropertyPicker.module.css`, `pickers.tsx`, `pickers.module.css`
- Test: `apps/web/src/components/PropertyPicker.test.tsx`, `apps/web/src/components/pickers.test.tsx`

**Interfaces:**
- Consumes: icons, primitives (Task 8); `useUsers, useLabels, useProjects, useCycles` (Task 8); `formatEstimate, cycleName` (Task 9).
- Produces:
  - `useDismiss(ref, open, onClose)` — closes on outside mousedown
  - `PropertyPicker<T extends string>(props)` with props `label`, `triggerLabel?`, `options: { value: T; label: string; icon?: ReactNode }[]`, `trigger: ReactNode`, `triggerClassName?`, `className?`, `searchable?`, `align?: 'start' | 'end'`, and either `{ value: T; onChange(v: T) }` or `{ multiple: true; value: T[]; onChange(v: T[]) }`. Trigger is a `button` named `triggerLabel ?? label`; popover is `role="listbox"` with `role="option"` buttons.
  - `type PickerVariant = 'icon' | 'boxed' | 'full' | 'chip'`
  - `StatusPicker({ value, onChange, variant? })` — trigger name `Status: <label>`
  - `PriorityPicker({ value, onChange, variant? })` — `Priority: <label>`
  - `AssigneePicker({ value: string | null, fallback?: User | null, onChange(id | null), variant?, size? })` — `Assignee: <name | No assignee>`
  - `LabelsPicker({ teamId, value: string[], onChange(ids), variant? })` — `Labels`
  - `ProjectPicker({ teamId, value: string | null, onChange(id | null), variant? })` — `Project: <name | No project>`
  - `CyclePicker({ teamId, value: string | null, onChange(id | null), variant? })` — `Cycle: <Cycle N | No cycle>`
  - `EstimatePicker({ value: number | null, onChange(n | null), variant? })` — `Estimate: <formatEstimate>`
  - `DueDateField({ value: string | null, onChange(v | null) })` — `input[type=date]` labelled `Due date`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/components/PropertyPicker.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PropertyPicker } from './PropertyPicker';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('PropertyPicker', () => {
  it('selects a single value and closes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertyPicker label="Letter" value="a" options={options} onChange={onChange} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not fire when the current value is picked again', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertyPicker label="Letter" value="a" options={options} onChange={onChange} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles values in multiple mode and stays open', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertyPicker multiple label="Letters" value={['a']} options={options} onChange={onChange} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letters' }));
    await user.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await user.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes on Escape and on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">outside</button>
        <PropertyPicker label="Letter" value="a" options={options} onChange={() => {}} trigger="Pick" />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters options when searchable', async () => {
    const user = userEvent.setup();
    render(<PropertyPicker searchable label="Letter" value="a" options={options} onChange={() => {}} trigger="Pick" />);
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    await user.type(screen.getByRole('textbox', { name: 'Filter letter' }), 'gam');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Gamma']);
    await user.clear(screen.getByRole('textbox', { name: 'Filter letter' }));
    await user.type(screen.getByRole('textbox', { name: 'Filter letter' }), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
```

`apps/web/src/components/pickers.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { AssigneePicker, CyclePicker, EstimatePicker, LabelsPicker, StatusPicker } from './pickers';

describe('pickers', () => {
  it('names the trigger after the current status', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<StatusPicker value="todo" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Status: Todo' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]);
    await user.click(screen.getByRole('option', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('maps "No assignee" to null', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<AssigneePicker value="u-anna" onChange={onChange} />);
    await user.click(await screen.findByRole('button', { name: 'Assignee: Anna Romanova' }));
    await user.click(screen.getByRole('option', { name: 'No assignee' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('maps estimates to numbers', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<EstimatePicker value={null} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Estimate: No estimate' }));
    await user.click(screen.getByRole('option', { name: '5 points' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("lists the team's labels and cycles", async () => {
    const onLabels = vi.fn();
    const { user } = renderWithProviders(
      <>
        <LabelsPicker teamId="t-dev" value={['l-bug']} onChange={onLabels} />
        <CyclePicker teamId="t-dev" value="c-14" onChange={() => {}} />
      </>,
    );
    expect(await screen.findByRole('button', { name: 'Cycle: Cycle 14' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Labels' }));
    await user.click(await screen.findByRole('option', { name: 'Feature' }));
    expect(onLabels).toHaveBeenCalledWith(['l-bug', 'l-feat']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test src/components/PropertyPicker src/components/pickers`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the generic picker**

`apps/web/src/lib/useDismiss.ts`:
```ts
import { useEffect, type RefObject } from 'react';

export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, open, onClose]);
}
```

`apps/web/src/components/PropertyPicker.module.css`:
```css
.root {
  position: relative;
  z-index: 1;
  display: inline-flex;
}
.open {
  z-index: 30;
}
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 0;
}
.popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
  background: var(--popover);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.end {
  left: auto;
  right: 0;
}
.search {
  margin: 2px 2px 4px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  outline: none;
}
.option {
  height: 32px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.option:hover,
.option:focus-visible {
  background: var(--btn-hover);
  outline: none;
}
.optionIcon {
  width: 18px;
  display: inline-flex;
  justify-content: center;
}
.optionIcon:empty {
  display: none;
}
.optionLabel {
  flex: 1;
  white-space: nowrap;
}
.check {
  color: var(--text-muted);
}
.empty {
  padding: 8px;
  color: var(--text-muted);
}
```

`apps/web/src/components/PropertyPicker.tsx`:
```tsx
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { useDismiss } from '../lib/useDismiss';
import { CheckIcon } from './icons';
import styles from './PropertyPicker.module.css';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface BaseProps<T extends string> {
  label: string;
  triggerLabel?: string;
  options: PickerOption<T>[];
  trigger: ReactNode;
  triggerClassName?: string;
  className?: string;
  searchable?: boolean;
  /** Which edge of the trigger the popover aligns to. */
  align?: 'start' | 'end';
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
}

interface MultipleProps<T extends string> extends BaseProps<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}

export function PropertyPicker<T extends string>(props: SingleProps<T> | MultipleProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const selected = new Set<string>(props.multiple ? props.value : [props.value]);
  const needle = query.trim().toLowerCase();
  const shown = props.options.filter((o) => o.label.toLowerCase().includes(needle));

  const pick = (value: T) => {
    if (props.multiple) {
      props.onChange(selected.has(value) ? props.value.filter((v) => v !== value) : [...props.value, value]);
      return;
    }
    setOpen(false);
    if (value !== props.value) props.onChange(value);
  };

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, open && styles.open, props.className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={props.triggerClassName ?? styles.trigger}
        aria-label={props.triggerLabel ?? props.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setQuery('');
          setOpen((o) => !o);
        }}
      >
        {props.trigger}
      </button>
      {open && (
        <div
          className={cx(styles.popover, props.align === 'end' && styles.end)}
          role="listbox" aria-label={props.label} aria-multiselectable={props.multiple || undefined}>
          {props.searchable && (
            <input
              autoFocus
              className={styles.search}
              placeholder={`${props.label}…`}
              aria-label={`Filter ${props.label.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {shown.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected.has(option.value)}
              className={styles.option}
              onClick={() => pick(option.value)}
            >
              <span className={styles.optionIcon}>{option.icon}</span>
              <span className={styles.optionLabel}>{option.label}</span>
              {selected.has(option.value) && <CheckIcon className={styles.check} />}
            </button>
          ))}
          {shown.length === 0 && <div className={styles.empty}>No results</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement the property-specific pickers**

`apps/web/src/components/pickers.module.css`:
```css
.icon,
.boxed,
.full,
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-size: 13px;
}
.icon {
  width: 24px;
  height: 24px;
  justify-content: center;
}
.icon:hover {
  background: var(--btn-hover);
}
.boxed {
  width: 22px;
  height: 22px;
  justify-content: center;
  border: 1px solid var(--surface-border);
}
.full {
  width: 100%;
  min-height: 34px;
  padding: 4px 8px;
  flex-wrap: wrap;
  text-align: left;
}
.full:hover {
  background: #1a1a1f;
}
.chip {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--surface-border);
  font-size: 12px;
}
.chip:hover {
  background: var(--btn-hover);
}
.block {
  display: flex;
  width: 100%;
}
.chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.date {
  height: 30px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
}
.date:hover,
.date:focus {
  border-color: var(--surface-border);
  outline: none;
}
```

`apps/web/src/components/pickers.tsx`:
```tsx
import {
  BOARD_STATUS_ORDER,
  ESTIMATE_OPTIONS,
  ISSUE_PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type IssuePriority,
  type IssueStatus,
  type User,
} from '@tm/shared';
import { useCycles, useLabels, useProjects, useUsers } from '../api/queries';
import { cycleName, formatEstimate } from '../lib/format';
import { PriorityIcon, ProjectIcon, StatusIcon } from './icons';
import { Avatar, LabelChip } from './primitives';
import styles from './pickers.module.css';
import { PropertyPicker } from './PropertyPicker';

export type PickerVariant = 'icon' | 'boxed' | 'full' | 'chip';

const withText = (variant: PickerVariant) => variant === 'full' || variant === 'chip';
const rootClass = (variant: PickerVariant) => (variant === 'full' ? styles.block : undefined);

export function StatusPicker({
  value,
  onChange,
  variant = 'icon',
}: {
  value: IssueStatus;
  onChange: (value: IssueStatus) => void;
  variant?: PickerVariant;
}) {
  return (
    <PropertyPicker
      label="Status"
      triggerLabel={`Status: ${STATUS_LABELS[value]}`}
      value={value}
      options={BOARD_STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s], icon: <StatusIcon status={s} /> }))}
      onChange={onChange}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <StatusIcon status={value} />
          {withText(variant) && <span>{STATUS_LABELS[value]}</span>}
        </>
      }
    />
  );
}

export function PriorityPicker({
  value,
  onChange,
  variant = 'icon',
}: {
  value: IssuePriority;
  onChange: (value: IssuePriority) => void;
  variant?: PickerVariant;
}) {
  return (
    <PropertyPicker
      label="Priority"
      triggerLabel={`Priority: ${PRIORITY_LABELS[value]}`}
      value={value}
      options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p], icon: <PriorityIcon priority={p} /> }))}
      onChange={onChange}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <PriorityIcon priority={value} size={variant === 'boxed' ? 12 : 14} />
          {withText(variant) && <span>{PRIORITY_LABELS[value]}</span>}
        </>
      }
    />
  );
}

export function AssigneePicker({
  value,
  fallback = null,
  onChange,
  variant = 'icon',
  size = 22,
}: {
  value: string | null;
  fallback?: User | null;
  onChange: (value: string | null) => void;
  variant?: PickerVariant;
  size?: number;
}) {
  const { data: users = [] } = useUsers();
  const current = users.find((u) => u.id === value) ?? (fallback && fallback.id === value ? fallback : null);
  return (
    <PropertyPicker
      label="Assignee"
      searchable
      triggerLabel={`Assignee: ${current?.name ?? 'No assignee'}`}
      value={value ?? ''}
      options={[
        { value: '', label: 'No assignee', icon: <Avatar user={null} size={18} /> },
        ...users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> })),
      ]}
      onChange={(v) => onChange(v || null)}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <Avatar user={current} size={withText(variant) ? 18 : size} />
          {withText(variant) && <span>{current?.name ?? 'Unassigned'}</span>}
        </>
      }
    />
  );
}

export function LabelsPicker({
  teamId,
  value,
  onChange,
  variant = 'full',
}: {
  teamId: string;
  value: string[];
  onChange: (value: string[]) => void;
  variant?: 'full' | 'chip';
}) {
  const { data: labels = [] } = useLabels(teamId);
  const selected = labels.filter((l) => value.includes(l.id));
  return (
    <PropertyPicker
      multiple
      searchable
      label="Labels"
      value={value}
      options={labels.map((l) => ({
        value: l.id,
        label: l.name,
        icon: <span className={styles.dot} style={{ background: l.color }} />,
      }))}
      onChange={onChange}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        selected.length > 0 ? (
          <span className={styles.chips}>
            {selected.map((l) => (
              <LabelChip key={l.id} label={l} />
            ))}
          </span>
        ) : (
          <span className="muted">Add label</span>
        )
      }
    />
  );
}

export function ProjectPicker({
  teamId,
  value,
  onChange,
  variant = 'full',
}: {
  teamId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: 'full' | 'chip';
}) {
  const { data: projects = [] } = useProjects(teamId);
  const current = projects.find((p) => p.id === value);
  return (
    <PropertyPicker
      label="Project"
      searchable
      triggerLabel={`Project: ${current?.name ?? 'No project'}`}
      value={value ?? ''}
      options={[
        { value: '', label: 'No project' },
        ...projects.map((p) => ({ value: p.id, label: p.name, icon: <ProjectIcon /> })),
      ]}
      onChange={(v) => onChange(v || null)}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <ProjectIcon className="muted" />
          <span className={current ? undefined : 'muted'}>{current?.name ?? 'No project'}</span>
        </>
      }
    />
  );
}

export function CyclePicker({
  teamId,
  value,
  onChange,
  variant = 'full',
}: {
  teamId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: 'full' | 'chip';
}) {
  const { data: cycles = [] } = useCycles(teamId);
  const current = cycles.find((c) => c.id === value);
  return (
    <PropertyPicker
      label="Cycle"
      triggerLabel={`Cycle: ${current ? `Cycle ${current.number}` : 'No cycle'}`}
      value={value ?? ''}
      options={[{ value: '', label: 'No cycle' }, ...cycles.map((c) => ({ value: c.id, label: cycleName(c) }))]}
      onChange={(v) => onChange(v || null)}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={<span className={current ? undefined : 'muted'}>{current ? cycleName(current) : 'No cycle'}</span>}
    />
  );
}

export function EstimatePicker({
  value,
  onChange,
  variant = 'full',
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  variant?: 'full' | 'chip';
}) {
  return (
    <PropertyPicker
      label="Estimate"
      triggerLabel={`Estimate: ${formatEstimate(value)}`}
      value={value === null ? '' : String(value)}
      options={[
        { value: '', label: 'No estimate' },
        ...ESTIMATE_OPTIONS.map((n) => ({ value: String(n), label: formatEstimate(n) })),
      ]}
      onChange={(v) => onChange(v === '' ? null : Number(v))}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={<span className={value === null ? 'muted' : undefined}>{formatEstimate(value)}</span>}
    />
  );
}

export function DueDateField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <input
      type="date"
      className={styles.date}
      aria-label="Due date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): property pickers for status, priority, assignee, labels, project, cycle, estimate"
```

---

### Task 11: New issue modal

**Files:**
- Create: `apps/web/src/api/mutations.ts`
- Create: `apps/web/src/lib/newIssue.tsx`, `apps/web/src/components/NewIssueModal.tsx`, `apps/web/src/components/NewIssueModal.module.css`
- Modify: `apps/web/src/App.tsx` (wrap children in `NewIssueProvider`)
- Modify: `apps/web/src/components/AppLayout.tsx` (pass `onNewIssue` to `Sidebar`)
- Test: `apps/web/src/components/NewIssueModal.test.tsx`

**Interfaces:**
- Consumes: `api.createIssue`, `useTeams`, pickers (Task 10), `useToast`.
- Produces:
  - `ISSUE_DATA_KEYS`, `invalidateIssueData(qc: QueryClient, keys = ISSUE_DATA_KEYS): Promise<void>` — invalidates `issues, issue, inbox, projects, project, cycles, cycle` by default
  - `useCreateIssue()` mutation (`mutate(input: IssueCreateInput)`)
  - `interface NewIssueDefaults { teamId?; status?; parentId?; projectId?; cycleId? }`, `NewIssueProvider`, `useNewIssue(): { open(defaults?: NewIssueDefaults): void }`
  - Dialog `role="dialog"` named "New issue", textbox "Issue title", textbox "Description", combobox "Team", button "Create issue"; on success shows toast `Created <KEY>`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/components/NewIssueModal.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock, server } from '../test/server';

async function openModal() {
  const utils = renderApp('/nowhere');
  await utils.user.click(await screen.findByRole('button', { name: 'New issue' }));
  const dialog = screen.getByRole('dialog', { name: 'New issue' });
  return { ...utils, dialog };
}

describe('NewIssueModal', () => {
  it('creates an issue from the sidebar button', async () => {
    const { user, dialog } = await openModal();
    const create = within(dialog).getByRole('button', { name: 'Create issue' });
    expect(create).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Write tests');
    await user.click(within(dialog).getByRole('button', { name: 'Priority: No priority' }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await user.click(create);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Created DEV-6')).toBeInTheDocument();
    const request = mock.requests.find((r) => r.method === 'POST' && r.path === '/api/issues');
    expect(request?.body).toEqual({
      teamId: 't-dev',
      title: 'Write tests',
      status: 'todo',
      priority: 'high',
      assigneeId: null,
      labelIds: [],
      projectId: null,
      cycleId: null,
      parentId: null,
    });
    expect(request?.userId).toBe('u-anna');
  });

  it('closes on Escape without creating anything', async () => {
    const { user, dialog } = await openModal();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Draft');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mock.requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('keeps the dialog open and shows the server error', async () => {
    server.use(
      http.post('*/api/issues', () =>
        HttpResponse.json({ error: { code: 'bad_request', message: 'Unknown team' } }, { status: 400 }),
      ),
    );
    const { user, dialog } = await openModal();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Broken');
    await user.click(within(dialog).getByRole('button', { name: 'Create issue' }));
    expect(await within(dialog).findByText('Unknown team')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New issue' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test NewIssueModal`
Expected: FAIL — clicking "New issue" opens nothing (`Unable to find role="dialog"`).

- [ ] **Step 3: Implement mutation hook and provider**

`apps/web/src/api/mutations.ts`:
```ts
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';

export const ISSUE_DATA_KEYS = ['issues', 'issue', 'inbox', 'projects', 'project', 'cycles', 'cycle'] as const;

export async function invalidateIssueData(
  qc: QueryClient,
  keys: readonly string[] = ISSUE_DATA_KEYS,
): Promise<void> {
  await Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key] })));
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createIssue, onSuccess: () => invalidateIssueData(qc) });
}
```

`apps/web/src/lib/newIssue.tsx`:
```tsx
import type { IssueStatus } from '@tm/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { NewIssueModal } from '../components/NewIssueModal';

export interface NewIssueDefaults {
  teamId?: string;
  status?: IssueStatus;
  parentId?: string | null;
  projectId?: string | null;
  cycleId?: string | null;
}

interface NewIssueValue {
  open: (defaults?: NewIssueDefaults) => void;
}

const NewIssueContext = createContext<NewIssueValue | null>(null);

export function NewIssueProvider({ children }: { children: ReactNode }) {
  const [defaults, setDefaults] = useState<NewIssueDefaults | null>(null);
  const value = useMemo<NewIssueValue>(() => ({ open: (d = {}) => setDefaults(d) }), []);
  return (
    <NewIssueContext.Provider value={value}>
      {children}
      {defaults && <NewIssueModal defaults={defaults} onClose={() => setDefaults(null)} />}
    </NewIssueContext.Provider>
  );
}

export function useNewIssue(): NewIssueValue {
  const value = useContext(NewIssueContext);
  if (!value) throw new Error('useNewIssue must be used inside NewIssueProvider');
  return value;
}
```

- [ ] **Step 4: Implement the modal**

`apps/web/src/components/NewIssueModal.module.css`:
```css
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
}
.modal {
  width: min(720px, 100%);
  background: var(--panel);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 0;
}
.teamSelect {
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
}
.headTitle {
  flex: 1;
  color: var(--text-muted);
}
.title {
  margin: 12px 16px 0;
  border: 0;
  background: transparent;
  font-size: 18px;
  font-weight: 600;
  outline: none;
}
.description {
  margin: 8px 16px 0;
  min-height: 72px;
  border: 0;
  background: transparent;
  color: var(--text-body);
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
  outline: none;
}
.props {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 16px;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--divider);
}
.error {
  flex: 1;
  color: var(--danger);
}
```

`apps/web/src/components/NewIssueModal.tsx`:
```tsx
import type { IssuePriority, IssueStatus } from '@tm/shared';
import { useState } from 'react';
import { useCreateIssue } from '../api/mutations';
import { useTeams } from '../api/queries';
import type { NewIssueDefaults } from '../lib/newIssue';
import { useToast } from '../lib/toast';
import { CloseIcon } from './icons';
import styles from './NewIssueModal.module.css';
import { AssigneePicker, CyclePicker, LabelsPicker, PriorityPicker, ProjectPicker, StatusPicker } from './pickers';

interface Draft {
  teamId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  labelIds: string[];
  projectId: string | null;
  cycleId: string | null;
  parentId: string | null;
}

export function NewIssueModal({ defaults, onClose }: { defaults: NewIssueDefaults; onClose: () => void }) {
  const { data: teams = [] } = useTeams();
  const create = useCreateIssue();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    teamId: defaults.teamId ?? '',
    title: '',
    description: '',
    status: defaults.status ?? 'todo',
    priority: 'none',
    assigneeId: null,
    labelIds: [],
    projectId: defaults.projectId ?? null,
    cycleId: defaults.cycleId ?? null,
    parentId: defaults.parentId ?? null,
  });
  const teamId = draft.teamId || teams[0]?.id || '';
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const canSubmit = draft.title.trim().length > 0 && teamId !== '' && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const { description, ...rest } = draft;
    create.mutate(
      { ...rest, teamId, title: draft.title.trim(), description: description.trim() ? description : undefined },
      {
        onSuccess: (issue) => {
          toast.show(`Created ${issue.key}`);
          onClose();
        },
      },
    );
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-issue-title"
        className={styles.modal}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <div className={styles.head}>
          <select
            className={styles.teamSelect}
            aria-label="Team"
            value={teamId}
            disabled={!!draft.parentId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, teamId: e.target.value, labelIds: [], projectId: null, cycleId: null }))
            }
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.key}
              </option>
            ))}
          </select>
          <span id="new-issue-title" className={styles.headTitle}>
            New issue
          </span>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <input
          autoFocus
          className={styles.title}
          placeholder="Issue title"
          aria-label="Issue title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
        />
        <textarea
          className={styles.description}
          placeholder="Add description…"
          aria-label="Description"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className={styles.props}>
          <StatusPicker variant="chip" value={draft.status} onChange={(v) => set('status', v)} />
          <PriorityPicker variant="chip" value={draft.priority} onChange={(v) => set('priority', v)} />
          <AssigneePicker variant="chip" value={draft.assigneeId} onChange={(v) => set('assigneeId', v)} />
          {teamId && (
            <>
              <LabelsPicker variant="chip" teamId={teamId} value={draft.labelIds} onChange={(v) => set('labelIds', v)} />
              <ProjectPicker variant="chip" teamId={teamId} value={draft.projectId} onChange={(v) => set('projectId', v)} />
              <CyclePicker variant="chip" teamId={teamId} value={draft.cycleId} onChange={(v) => set('cycleId', v)} />
            </>
          )}
        </div>
        <div className={styles.foot}>
          {create.isError && <span className={styles.error}>{create.error.message}</span>}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            Create issue
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire the provider and the sidebar button**

In `apps/web/src/App.tsx` add `import { NewIssueProvider } from './lib/newIssue';` and change `AppProviders` to:
```tsx
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CurrentUserProvider>
        <NewIssueProvider>{children}</NewIssueProvider>
      </CurrentUserProvider>
    </ToastProvider>
  );
}
```

Replace `apps/web/src/components/AppLayout.tsx` with:
```tsx
import { Outlet } from 'react-router';
import { useNewIssue } from '../lib/newIssue';
import styles from './AppLayout.module.css';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const newIssue = useNewIssue();
  return (
    <div className={styles.shell}>
      <Sidebar onNewIssue={() => newIssue.open()} />
      <main className={styles.panel}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): new issue modal opened from the sidebar"
```

---
### Task 12: Issue list page (groups, tabs, filters, display, optimistic edits)

**Files:**
- Modify: `apps/web/src/api/mutations.ts` (add `useUpdateIssue`, `useCreateView`)
- Create: `apps/web/src/lib/useDensity.ts`, `apps/web/src/lib/tabs.ts`
- Create: `apps/web/src/components/IssueRow.tsx`, `IssueRow.module.css`, `IssueList.tsx`, `IssueList.module.css`, `FilterMenu.tsx`, `FilterMenu.module.css`, `DisplayMenu.tsx`, `ViewToggle.tsx`, `ViewToggle.module.css`, `TeamIssuesHeader.tsx`
- Create: `apps/web/src/pages/IssueListPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `team/:teamKey/issues`)
- Test: `apps/web/src/pages/IssueListPage.test.tsx`

**Interfaces:**
- Consumes: `api.updateIssue`, `api.createView`, `qk`, `useIssues`, `useTeamByKey`, `useUsers`, `useLabels`, `useProjects`, `useCycles`, pickers, `applyPatch`, `filtersFromSearch`, `applyFiltersToSearch`, `countFilters`, `useNewIssue`, `useToast`.
- Produces:
  - `useUpdateIssue()` — `mutate({ id, patch })`; optimistic over every cached `['issues', …]` list and `['issue', …]` detail (incl. children); rollback + toast `Couldn't save: <message>` on error; invalidates issue data when settled
  - `useCreateView()` — `mutate(input: ViewCreateInput)` → `View`
  - `type Density = 'comfortable' | 'compact'`, `useDensity(): [Density, (d) => void]` (localStorage `tm.density`)
  - `interface IssueTab { id: 'all' | 'active' | 'backlog'; label; list: readonly IssueStatus[]; board: readonly IssueStatus[] }`, `ISSUE_TABS`, `tabFromSearch(sp): IssueTab`
  - `IssueRow({ issue, density })`, `IssueList({ issues, statuses?, density?, emptyTitle?, onCreate? })`, `IssueQueryList({ query, ...IssueList props without issues })`
  - `FilterMenu({ teamId?, value: FilterFields, onChange(f), onSaveView?(name) })`, `DisplayMenu({ value, onChange })`, `ViewToggle({ teamKey, active, search })`, `TeamIssuesHeader({ team, view: 'list' | 'board', density?, onDensityChange? })`
  - Each status group is a `<section aria-label="<Status label>">` (role `region`)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/IssueListPage.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock, server } from '../test/server';

const groupNames = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
const group = (name: string) => screen.getByRole('region', { name });
const rowOf = async (title: string) => (await screen.findByRole('link', { name: title })).closest('li')!;

describe('IssueListPage', () => {
  it('groups issues by status in list order with Done collapsed', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    expect(groupNames()).toEqual(['In Progress', 'In Review', 'Todo', 'Backlog', 'Done']);
    expect(within(group('Done')).queryByRole('link', { name: 'Faster search' })).not.toBeInTheDocument();
    await user.click(within(group('Done')).getByRole('button', { name: /Done/ }));
    expect(within(group('Done')).getByRole('link', { name: 'Faster search' })).toBeInTheDocument();
  });

  it('limits the groups on the Active tab', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('tab', { name: 'Active' }));
    expect(groupNames()).toEqual(['In Progress', 'In Review', 'Todo']);
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
  });

  it('changes the status from the row and sends a PATCH', async () => {
    const { user } = renderApp('/team/DEV/issues');
    const row = await rowOf('Export to CSV');
    await user.click(within(row).getByRole('button', { name: 'Status: Todo' }));
    await user.click(screen.getByRole('option', { name: 'In Progress' }));
    await waitFor(() =>
      expect(within(group('In Progress')).getByRole('link', { name: 'Export to CSV' })).toBeInTheDocument(),
    );
    expect(mock.requests.find((r) => r.method === 'PATCH')).toMatchObject({
      path: '/api/issues/i-3',
      body: { status: 'in_progress' },
      userId: 'u-anna',
    });
  });

  it('applies edits optimistically and rolls back with a toast when saving fails', async () => {
    server.use(
      http.patch('*/api/issues/:id', async () => {
        await delay(50);
        return HttpResponse.json({ error: { code: 'internal', message: 'Boom' } }, { status: 500 });
      }),
    );
    const { user } = renderApp('/team/DEV/issues');
    const row = await rowOf('Export to CSV');
    await user.click(within(row).getByRole('button', { name: 'Priority: Low' }));
    await user.click(screen.getByRole('option', { name: 'Urgent' }));
    expect(await within(row).findByRole('button', { name: 'Priority: Urgent' })).toBeInTheDocument();
    expect(await screen.findByText("Couldn't save: Boom")).toBeInTheDocument();
    expect(await within(row).findByRole('button', { name: 'Priority: Low' })).toBeInTheDocument();
  });

  it('filters through the Filter menu', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('button', { name: /^Filter/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Todo' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Crash on upload' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Export to CSV' })).toBeInTheDocument();
    expect(mock.requests.some((r) => r.path === '/api/issues?teamId=t-dev&status=todo')).toBe(true);
  });

  it('saves the current filters as a view', async () => {
    const { user } = renderApp('/team/DEV/issues?status=todo');
    await screen.findByRole('link', { name: 'Export to CSV' });
    await user.click(screen.getByRole('button', { name: /^Filter/ }));
    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    await user.type(screen.getByRole('textbox', { name: 'View name' }), 'My todo');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'POST' && r.path === '/api/views')?.body).toEqual({
        name: 'My todo',
        filters: { status: ['todo'], teamId: 't-dev' },
      }),
    );
  });

  it('remembers the compact density', async () => {
    const { user } = renderApp('/team/DEV/issues');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('button', { name: 'Display' }));
    await user.click(screen.getByRole('option', { name: 'Compact' }));
    expect(localStorage.getItem('tm.density')).toBe('compact');
  });

  it('shows an empty state that opens the new issue dialog', async () => {
    server.use(http.get('*/api/issues', () => HttpResponse.json([])));
    const { user } = renderApp('/team/DEV/issues');
    expect(await screen.findByText('No issues')).toBeInTheDocument();
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'New issue' }));
    expect(screen.getByRole('dialog', { name: 'New issue' })).toBeInTheDocument();
  });

  it('shows not found for an unknown team', async () => {
    renderApp('/team/NOPE/issues');
    expect(await screen.findByText('Team not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test IssueListPage`
Expected: FAIL — the route renders "Page not found".

- [ ] **Step 3: Mutations, density and tabs**

Append to `apps/web/src/api/mutations.ts` (extend imports: `import type { IssueDetail, IssueListItem, IssueUpdateInput, Label, User } from '@tm/shared';`, `import { applyPatch } from '../lib/applyPatch';`, `import { useToast } from '../lib/toast';`, `import { qk } from './queries';`):
```ts
export function useUpdateIssue() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IssueUpdateInput }) => api.updateIssue(id, patch),
    onMutate: async ({ id, patch }) => {
      await Promise.all([qc.cancelQueries({ queryKey: ['issues'] }), qc.cancelQueries({ queryKey: ['issue'] })]);
      const lists = qc.getQueriesData<IssueListItem[]>({ queryKey: ['issues'] });
      const details = qc.getQueriesData<IssueDetail>({ queryKey: ['issue'] });
      const ctx = {
        users: qc.getQueryData<User[]>(qk.users) ?? [],
        labels: qc.getQueriesData<Label[]>({ queryKey: ['labels'] }).flatMap(([, data]) => data ?? []),
      };
      const apply = (issue: IssueListItem) => (issue.id === id ? applyPatch(issue, patch, ctx) : issue);
      for (const [key, data] of lists) if (data) qc.setQueryData(key, data.map(apply));
      for (const [key, data] of details) {
        if (!data) continue;
        const base = data.id === id ? applyPatch(data, patch, ctx) : data;
        qc.setQueryData<IssueDetail>(key, { ...base, children: base.children.map(apply) });
      }
      return { lists, details };
    },
    onError: (error, _vars, context) => {
      context?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      context?.details.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.show(`Couldn't save: ${error.message}`, 'error');
    },
    onSettled: () => invalidateIssueData(qc),
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createView, onSuccess: () => qc.invalidateQueries({ queryKey: qk.views }) });
}
```

`apps/web/src/lib/useDensity.ts`:
```ts
import { useCallback, useState } from 'react';
import { storage } from './storage';

export type Density = 'comfortable' | 'compact';

const KEY = 'tm.density';

export function useDensity(): [Density, (density: Density) => void] {
  const [density, setDensity] = useState<Density>(() => (storage.get(KEY) === 'compact' ? 'compact' : 'comfortable'));
  const update = useCallback((next: Density) => {
    storage.set(KEY, next);
    setDensity(next);
  }, []);
  return [density, update];
}
```

`apps/web/src/lib/tabs.ts`:
```ts
import { ACTIVE_STATUSES, BOARD_STATUS_ORDER, LIST_STATUS_ORDER, type IssueStatus } from '@tm/shared';

export interface IssueTab {
  id: 'all' | 'active' | 'backlog';
  label: string;
  list: readonly IssueStatus[];
  board: readonly IssueStatus[];
}

export const ISSUE_TABS: readonly IssueTab[] = [
  { id: 'all', label: 'All issues', list: LIST_STATUS_ORDER, board: BOARD_STATUS_ORDER },
  { id: 'active', label: 'Active', list: ACTIVE_STATUSES, board: ['todo', 'in_progress', 'in_review'] },
  { id: 'backlog', label: 'Backlog', list: ['backlog'], board: ['backlog'] },
];

export function tabFromSearch(sp: URLSearchParams): IssueTab {
  return ISSUE_TABS.find((t) => t.id === sp.get('tab')) ?? ISSUE_TABS[0];
}
```

- [ ] **Step 4: Row and list components**

`apps/web/src/components/IssueRow.module.css`:
```css
.row {
  position: relative;
  height: 44px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--divider-soft);
}
.row:hover {
  background: var(--surface-hover);
}
.compact {
  height: 36px;
}
.key {
  width: 64px;
  flex: none;
}
.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.title::after {
  content: '';
  position: absolute;
  inset: 0;
}
.meta {
  display: flex;
  gap: 6px;
  flex: none;
}
.date {
  width: 52px;
  justify-content: flex-end;
  font-size: 12px;
  color: var(--text-muted);
}
@media (max-width: 760px) {
  .meta {
    display: none;
  }
}
```

`apps/web/src/components/IssueRow.tsx`:
```tsx
import type { IssueListItem, IssueUpdateInput } from '@tm/shared';
import { Link } from 'react-router';
import { useUpdateIssue } from '../api/mutations';
import { cx } from '../lib/cx';
import { formatShortDate } from '../lib/format';
import type { Density } from '../lib/useDensity';
import styles from './IssueRow.module.css';
import { AssigneePicker, PriorityPicker, StatusPicker } from './pickers';
import { LabelChip } from './primitives';

export function IssueRow({ issue, density }: { issue: IssueListItem; density: Density }) {
  const update = useUpdateIssue();
  const save = (patch: IssueUpdateInput) => update.mutate({ id: issue.id, patch });
  return (
    <li className={cx(styles.row, density === 'compact' && styles.compact)}>
      <PriorityPicker value={issue.priority} onChange={(priority) => save({ priority })} />
      <span className={cx('mono muted', styles.key)}>{issue.key}</span>
      <StatusPicker value={issue.status} onChange={(status) => save({ status })} />
      <Link to={`/issue/${issue.key}`} className={styles.title}>
        {issue.title}
      </Link>
      <span className={styles.meta}>
        {issue.labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </span>
      <span className={cx(styles.meta, styles.date)}>{formatShortDate(issue.createdAt)}</span>
      <AssigneePicker
        value={issue.assignee?.id ?? null}
        fallback={issue.assignee}
        onChange={(assigneeId) => save({ assigneeId })}
      />
    </li>
  );
}
```

`apps/web/src/components/IssueList.module.css`:
```css
.group {
  width: 100%;
  height: 36px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: var(--group-bg);
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.group:hover {
  background: var(--group-hover);
}
.chevron {
  color: var(--text-muted);
  transition: transform 0.15s;
}
.chevronOpen {
  composes: chevron;
  transform: rotate(90deg);
}
.groupIcon {
  display: inline-flex;
}
.groupName {
  font-weight: 500;
}
.items {
  list-style: none;
  margin: 0;
  padding: 0;
}
```

`apps/web/src/components/IssueList.tsx`:
```tsx
import { LIST_STATUS_ORDER, STATUS_LABELS, type IssueListItem, type IssueStatus } from '@tm/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { Density } from '../lib/useDensity';
import { ChevronIcon, StatusIcon } from './icons';
import styles from './IssueList.module.css';
import { IssueRow } from './IssueRow';
import { EmptyState, ErrorState, ListSkeleton } from './states';

export interface IssueListProps {
  issues: IssueListItem[];
  statuses?: readonly IssueStatus[];
  density?: Density;
  emptyTitle?: string;
  onCreate?: () => void;
}

export function IssueList({
  issues,
  statuses = LIST_STATUS_ORDER,
  density = 'comfortable',
  emptyTitle = 'No issues',
  onCreate,
}: IssueListProps) {
  const [closed, setClosed] = useState<Set<IssueStatus>>(() => new Set(['done']));
  const groups = statuses
    .map((status) => ({ status, items: issues.filter((i) => i.status === status) }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        action={
          onCreate && (
            <button type="button" className="btn" onClick={onCreate}>
              New issue
            </button>
          )
        }
      />
    );
  }

  const toggle = (status: IssueStatus) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  return (
    <div>
      {groups.map(({ status, items }) => {
        const open = !closed.has(status);
        return (
          <section key={status} aria-label={STATUS_LABELS[status]}>
            <button type="button" className={styles.group} aria-expanded={open} onClick={() => toggle(status)}>
              <ChevronIcon className={open ? styles.chevronOpen : styles.chevron} />
              <span className={styles.groupIcon} aria-hidden="true">
                <StatusIcon status={status} />
              </span>
              <span className={styles.groupName}>{STATUS_LABELS[status]}</span>
              <span className="muted">{items.length}</span>
            </button>
            {open && (
              <ul className={styles.items}>
                {items.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} density={density} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function IssueQueryList({
  query,
  ...props
}: { query: UseQueryResult<IssueListItem[], Error> } & Omit<IssueListProps, 'issues'>) {
  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <IssueList issues={query.data} {...props} />;
}
```

- [ ] **Step 5: Header controls**

`apps/web/src/components/FilterMenu.module.css`:
```css
.root {
  position: relative;
}
.badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.popover {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 40;
  width: 300px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 12px;
  background: var(--popover);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.legend {
  padding: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.check {
  height: 28px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.check:hover {
  background: var(--btn-hover);
}
.check input {
  margin: 0;
  accent-color: var(--accent);
}
.select {
  width: 100%;
}
.footer {
  padding-top: 8px;
  border-top: 1px solid var(--divider);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}
.saveForm {
  flex: 1;
  display: flex;
  gap: 6px;
}
.saveForm input {
  flex: 1;
  min-width: 0;
  height: 28px;
}
```

`apps/web/src/components/FilterMenu.tsx`:
```tsx
import { BOARD_STATUS_ORDER, ISSUE_PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from '@tm/shared';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useCycles, useLabels, useProjects, useUsers } from '../api/queries';
import { countFilters, type FilterFields } from '../lib/filters';
import { cycleName } from '../lib/format';
import { useDismiss } from '../lib/useDismiss';
import styles from './FilterMenu.module.css';
import { FilterIcon, PriorityIcon, StatusIcon } from './icons';
import { Avatar } from './primitives';

type ArrayKey = 'status' | 'priority' | 'assigneeId' | 'labelId';

function Check({ checked, onToggle, icon, label }: { checked: boolean; onToggle: () => void; icon?: ReactNode; label: string }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </label>
  );
}

export function FilterMenu({
  teamId,
  value,
  onChange,
  onSaveView,
}: {
  teamId?: string;
  value: FilterFields;
  onChange: (filters: FilterFields) => void;
  onSaveView?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);
  const { data: users = [] } = useUsers();
  const { data: labels = [] } = useLabels(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: cycles = [] } = useCycles(teamId);
  const count = countFilters(value);

  const toggle = (key: ArrayKey, item: string) => {
    const current = (value[key] ?? []) as string[];
    const next = current.includes(item) ? current.filter((v) => v !== item) : [...current, item];
    onChange({ ...value, [key]: next.length ? next : undefined });
  };
  const has = (key: ArrayKey, item: string) => ((value[key] ?? []) as string[]).includes(item);

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <FilterIcon />
        Filter
        {count > 0 && <span className={styles.badge}>{count}</span>}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Filters">
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Status</legend>
            {BOARD_STATUS_ORDER.map((s) => (
              <Check key={s} checked={has('status', s)} onToggle={() => toggle('status', s)} icon={<StatusIcon status={s} />} label={STATUS_LABELS[s]} />
            ))}
          </fieldset>
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Priority</legend>
            {ISSUE_PRIORITIES.map((p) => (
              <Check key={p} checked={has('priority', p)} onToggle={() => toggle('priority', p)} icon={<PriorityIcon priority={p} />} label={PRIORITY_LABELS[p]} />
            ))}
          </fieldset>
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Assignee</legend>
            {users.map((u) => (
              <Check key={u.id} checked={has('assigneeId', u.id)} onToggle={() => toggle('assigneeId', u.id)} icon={<Avatar user={u} size={16} />} label={u.name} />
            ))}
          </fieldset>
          {labels.length > 0 && (
            <fieldset className={styles.section}>
              <legend className={styles.legend}>Labels</legend>
              {labels.map((l) => (
                <Check key={l.id} checked={has('labelId', l.id)} onToggle={() => toggle('labelId', l.id)} label={l.name} />
              ))}
            </fieldset>
          )}
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Project</legend>
            <select
              className={`input ${styles.select}`}
              aria-label="Project filter"
              value={value.projectId ?? ''}
              onChange={(e) => onChange({ ...value, projectId: e.target.value || undefined })}
            >
              <option value="">Any project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </fieldset>
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Cycle</legend>
            <select
              className={`input ${styles.select}`}
              aria-label="Cycle filter"
              value={value.cycleId ?? ''}
              onChange={(e) => onChange({ ...value, cycleId: e.target.value || undefined })}
            >
              <option value="">Any cycle</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {cycleName(c)}
                </option>
              ))}
            </select>
          </fieldset>
          <div className={styles.footer}>
            <button type="button" className="btn" disabled={count === 0} onClick={() => onChange({})}>
              Clear
            </button>
            {onSaveView &&
              (saving ? (
                <form
                  className={styles.saveForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!name.trim()) return;
                    onSaveView(name.trim());
                    setSaving(false);
                    setName('');
                    setOpen(false);
                  }}
                >
                  <input autoFocus className="input" placeholder="View name" aria-label="View name" value={name} onChange={(e) => setName(e.target.value)} />
                  <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                    Save
                  </button>
                </form>
              ) : (
                <button type="button" className="btn" onClick={() => setSaving(true)}>
                  Save as view
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

`apps/web/src/components/DisplayMenu.tsx`:
```tsx
import type { Density } from '../lib/useDensity';
import { DisplayIcon } from './icons';
import { PropertyPicker } from './PropertyPicker';

export function DisplayMenu({ value, onChange }: { value: Density; onChange: (density: Density) => void }) {
  return (
    <PropertyPicker
      label="Display"
      align="end"
      value={value}
      options={[
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
      ]}
      onChange={onChange}
      triggerClassName="btn"
      trigger={
        <>
          <DisplayIcon />
          Display
        </>
      }
    />
  );
}
```

`apps/web/src/components/ViewToggle.module.css`:
```css
.toggle {
  display: flex;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.option {
  width: 32px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
.option:hover {
  color: var(--text);
}
.active {
  background: var(--chip-active-bg);
  color: var(--text);
}
```

`apps/web/src/components/ViewToggle.tsx`:
```tsx
import { Link } from 'react-router';
import { cx } from '../lib/cx';
import { BoardIcon, ListIcon } from './icons';
import styles from './ViewToggle.module.css';

export function ViewToggle({ teamKey, active, search }: { teamKey: string; active: 'list' | 'board'; search: URLSearchParams }) {
  const query = search.toString();
  const suffix = query ? `?${query}` : '';
  return (
    <div className={styles.toggle}>
      <Link
        to={`/team/${teamKey}/issues${suffix}`}
        aria-label="List"
        aria-current={active === 'list' ? 'page' : undefined}
        className={cx(styles.option, active === 'list' && styles.active)}
      >
        <ListIcon />
      </Link>
      <Link
        to={`/team/${teamKey}/board${suffix}`}
        aria-label="Board"
        aria-current={active === 'board' ? 'page' : undefined}
        className={cx(styles.option, active === 'board' && styles.active)}
      >
        <BoardIcon />
      </Link>
    </div>
  );
}
```

`apps/web/src/components/TeamIssuesHeader.tsx`:
```tsx
import type { Team } from '@tm/shared';
import { useNavigate, useSearchParams } from 'react-router';
import { useCreateView } from '../api/mutations';
import { cx } from '../lib/cx';
import { applyFiltersToSearch, filtersFromSearch } from '../lib/filters';
import { ISSUE_TABS, tabFromSearch, type IssueTab } from '../lib/tabs';
import type { Density } from '../lib/useDensity';
import page from '../pages/page.module.css';
import { DisplayMenu } from './DisplayMenu';
import { FilterMenu } from './FilterMenu';
import { PageHeader } from './PageHeader';
import { TeamCrumb } from './primitives';
import { ViewToggle } from './ViewToggle';

export function TeamIssuesHeader({
  team,
  view,
  density,
  onDensityChange,
}: {
  team: Team;
  view: 'list' | 'board';
  density?: Density;
  onDensityChange?: (density: Density) => void;
}) {
  const [sp, setSp] = useSearchParams();
  const tab = tabFromSearch(sp);
  const filters = filtersFromSearch(sp);
  const createView = useCreateView();
  const navigate = useNavigate();

  const selectTab = (id: IssueTab['id']) => {
    const next = new URLSearchParams(sp);
    if (id === 'all') next.delete('tab');
    else next.set('tab', id);
    setSp(next);
  };

  return (
    <PageHeader crumbs={[{ label: <TeamCrumb team={team} /> }, { label: 'Issues' }]}>
      <div role="tablist" aria-label="Issue filter" className={page.tabs}>
        {ISSUE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab.id}
            className={cx(page.tab, t.id === tab.id && page.tabActive)}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={page.spacer} />
      <div className={page.actions}>
        <FilterMenu
          teamId={team.id}
          value={filters}
          onChange={(f) => setSp(applyFiltersToSearch(sp, f))}
          onSaveView={(name) =>
            createView.mutate(
              { name, filters: { ...filters, teamId: team.id } },
              { onSuccess: (created) => navigate(`/views/${created.id}`) },
            )
          }
        />
        <ViewToggle teamKey={team.key} active={view} search={sp} />
        {density && onDensityChange && <DisplayMenu value={density} onChange={onDensityChange} />}
      </div>
    </PageHeader>
  );
}
```

- [ ] **Step 6: The page and its route**

`apps/web/src/pages/IssueListPage.tsx`:
```tsx
import { useParams, useSearchParams } from 'react-router';
import { useIssues, useTeamByKey } from '../api/queries';
import { IssueQueryList } from '../components/IssueList';
import { ListSkeleton } from '../components/states';
import { TeamIssuesHeader } from '../components/TeamIssuesHeader';
import { filtersFromSearch } from '../lib/filters';
import { useNewIssue } from '../lib/newIssue';
import { tabFromSearch } from '../lib/tabs';
import { useDensity } from '../lib/useDensity';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function IssueListPage() {
  const { teamKey = '' } = useParams();
  const { team, isLoading } = useTeamByKey(teamKey);
  const [sp] = useSearchParams();
  const [density, setDensity] = useDensity();
  const newIssue = useNewIssue();
  const issues = useIssues({ teamId: team?.id, ...filtersFromSearch(sp) }, { enabled: !!team });

  if (isLoading) return <ListSkeleton />;
  if (!team) return <NotFound title="Team not found" />;

  return (
    <>
      <TeamIssuesHeader team={team} view="list" density={density} onDensityChange={setDensity} />
      <div className={page.scroll}>
        <IssueQueryList
          query={issues}
          statuses={tabFromSearch(sp).list}
          density={density}
          onCreate={() => newIssue.open({ teamId: team.id })}
        />
      </div>
    </>
  );
}
```

In `apps/web/src/App.tsx` add `import { IssueListPage } from './pages/IssueListPage';` and the route before the `*` route:
```tsx
        <Route path="team/:teamKey/issues" element={<IssueListPage />} />
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): issue list with status groups, tabs, filters, saved views and optimistic edits"
```

---

### Task 13: Board with drag & drop

**Files:**
- Create: `apps/web/src/components/IssueCard.tsx`, `IssueCard.module.css`, `BoardColumn.tsx`, `BoardColumn.module.css`
- Create: `apps/web/src/pages/BoardPage.tsx`, `apps/web/src/pages/BoardPage.module.css`
- Modify: `apps/web/src/App.tsx` (route `team/:teamKey/board`)
- Test: `apps/web/src/pages/BoardPage.test.tsx`

**Interfaces:**
- Consumes: `useUpdateIssue`, `TeamIssuesHeader`, `tabFromSearch(...).board`, `groupByStatus`, `planMove`, `columnId`, pickers, `useNewIssue`.
- Produces: `IssueCard({ issue, overlay? })`, `BoardColumn({ status, issues, onAdd })` — `<section aria-label="<Status>">` with an "Add issue to <Status>" button and a droppable area id `column:<status>`; `BoardPage`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/BoardPage.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

const column = (name: string) => screen.getByRole('region', { name });

describe('BoardPage', () => {
  it('renders the columns in board order with their cards', async () => {
    renderApp('/team/DEV/board');
    await screen.findByRole('link', { name: 'Crash on upload' });
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]);
    expect(within(column('In Progress')).getByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(within(column('Done')).getByLabelText('1 issues')).toBeInTheDocument();
  });

  it('hides columns outside the Active tab', async () => {
    const { user } = renderApp('/team/DEV/board');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('tab', { name: 'Active' }));
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Todo',
      'In Progress',
      'In Review',
    ]);
  });

  it('opens the new issue dialog with the column status preselected', async () => {
    const { user } = renderApp('/team/DEV/board');
    await screen.findByRole('link', { name: 'Crash on upload' });
    await user.click(screen.getByRole('button', { name: 'Add issue to In Review' }));
    const dialog = screen.getByRole('dialog', { name: 'New issue' });
    expect(within(dialog).getByRole('button', { name: 'Status: In Review' })).toBeInTheDocument();
  });

  it('edits the priority from a card', async () => {
    const { user } = renderApp('/team/DEV/board');
    const card = (await screen.findByRole('link', { name: 'Export to CSV' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Priority: Low' }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'PATCH')).toMatchObject({ body: { priority: 'high' } }),
    );
  });

  it('switches to the list view keeping the query string', async () => {
    renderApp('/team/DEV/board?status=todo');
    expect(await screen.findByRole('link', { name: 'List' })).toHaveAttribute('href', '/team/DEV/issues?status=todo');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test BoardPage`
Expected: FAIL — "Page not found".

- [ ] **Step 3: Card and column**

`apps/web/src/components/IssueCard.module.css`:
```css
.card {
  position: relative;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}
.card:hover {
  border-color: var(--card-hover-border);
  background: var(--card-hover);
}
.overlay {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  cursor: grabbing;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.key {
  flex: 1;
}
.title {
  font-weight: 500;
  line-height: 1.35;
  color: var(--text);
}
.title::after {
  content: '';
  position: absolute;
  inset: 0;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
```

`apps/web/src/components/IssueCard.tsx`:
```tsx
import type { IssueListItem, IssueUpdateInput } from '@tm/shared';
import { Link } from 'react-router';
import { useUpdateIssue } from '../api/mutations';
import { cx } from '../lib/cx';
import styles from './IssueCard.module.css';
import { AssigneePicker, PriorityPicker } from './pickers';
import { LabelChip } from './primitives';

export function IssueCard({ issue, overlay = false }: { issue: IssueListItem; overlay?: boolean }) {
  const update = useUpdateIssue();
  const save = (patch: IssueUpdateInput) => update.mutate({ id: issue.id, patch });
  return (
    <article className={cx(styles.card, overlay && styles.overlay)}>
      <div className={styles.top}>
        <span className={cx('mono muted', styles.key)}>{issue.key}</span>
        <AssigneePicker
          size={20}
          value={issue.assignee?.id ?? null}
          fallback={issue.assignee}
          onChange={(assigneeId) => save({ assigneeId })}
        />
      </div>
      <Link to={`/issue/${issue.key}`} className={styles.title}>
        {issue.title}
      </Link>
      <div className={styles.meta}>
        <PriorityPicker variant="boxed" value={issue.priority} onChange={(priority) => save({ priority })} />
        {issue.labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </div>
    </article>
  );
}
```

`apps/web/src/components/BoardColumn.module.css`:
```css
.column {
  width: 272px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--radius-md);
}
.over {
  background: rgba(94, 99, 230, 0.06);
}
.header {
  height: 32px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  font-weight: 500;
}
.spacer {
  flex: 1;
}
.cards {
  min-height: 60px;
  padding-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

`apps/web/src/components/BoardColumn.tsx`:
```tsx
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STATUS_LABELS, type IssueListItem, type IssueStatus } from '@tm/shared';
import { columnId } from '../lib/boardMove';
import { cx } from '../lib/cx';
import styles from './BoardColumn.module.css';
import { IssueCard } from './IssueCard';
import { PlusIcon, StatusIcon } from './icons';

function SortableCard({ issue }: { issue: IssueListItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <IssueCard issue={issue} />
    </div>
  );
}

export function BoardColumn({ status, issues, onAdd }: { status: IssueStatus; issues: IssueListItem[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const label = STATUS_LABELS[status];
  return (
    <section aria-label={label} className={cx(styles.column, isOver && styles.over)}>
      <div className={styles.header}>
        <span aria-hidden="true">
          <StatusIcon status={status} />
        </span>
        <span className={styles.name}>{label}</span>
        <span className="muted" aria-label={`${issues.length} issues`}>
          {issues.length}
        </span>
        <span className={styles.spacer} />
        <button type="button" className="icon-btn" aria-label={`Add issue to ${label}`} onClick={onAdd}>
          <PlusIcon />
        </button>
      </div>
      <SortableContext id={columnId(status)} items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.cards}>
          {issues.map((issue) => (
            <SortableCard key={issue.id} issue={issue} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
```

- [ ] **Step 4: The page and its route**

`apps/web/src/pages/BoardPage.module.css`:
```css
.board {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
```

`apps/web/src/pages/BoardPage.tsx`:
```tsx
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useUpdateIssue } from '../api/mutations';
import { useIssues, useTeamByKey } from '../api/queries';
import { BoardColumn } from '../components/BoardColumn';
import { IssueCard } from '../components/IssueCard';
import { ErrorState, ListSkeleton } from '../components/states';
import { TeamIssuesHeader } from '../components/TeamIssuesHeader';
import { groupByStatus, planMove } from '../lib/boardMove';
import { filtersFromSearch } from '../lib/filters';
import { useNewIssue } from '../lib/newIssue';
import { tabFromSearch } from '../lib/tabs';
import styles from './BoardPage.module.css';
import { NotFound } from './NotFound';

export function BoardPage() {
  const { teamKey = '' } = useParams();
  const { team, isLoading } = useTeamByKey(teamKey);
  const [sp] = useSearchParams();
  const issues = useIssues({ teamId: team?.id, ...filtersFromSearch(sp) }, { enabled: !!team });
  const update = useUpdateIssue();
  const newIssue = useNewIssue();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const columns = useMemo(() => groupByStatus(issues.data ?? []), [issues.data]);

  if (isLoading) return <ListSkeleton />;
  if (!team) return <NotFound title="Team not found" />;

  const dragged = draggedId ? issues.data?.find((i) => i.id === draggedId) : undefined;
  const onDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    if (!event.over) return;
    const move = planMove(columns, String(event.active.id), String(event.over.id));
    if (move) update.mutate({ id: String(event.active.id), patch: move });
  };

  return (
    <>
      <TeamIssuesHeader team={team} view="board" />
      {issues.isPending ? (
        <ListSkeleton />
      ) : issues.isError ? (
        <ErrorState error={issues.error} onRetry={() => void issues.refetch()} />
      ) : (
        <div className={styles.board}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(event) => setDraggedId(String(event.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDraggedId(null)}
          >
            {tabFromSearch(sp).board.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                issues={columns[status]}
                onAdd={() => newIssue.open({ teamId: team.id, status })}
              />
            ))}
            <DragOverlay>{dragged ? <IssueCard issue={dragged} overlay /> : null}</DragOverlay>
          </DndContext>
        </div>
      )}
    </>
  );
}
```

In `apps/web/src/App.tsx` add `import { BoardPage } from './pages/BoardPage';` and the route:
```tsx
        <Route path="team/:teamKey/board" element={<BoardPage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): kanban board with drag and drop between and within columns"
```

---

### Task 14: Issue detail page

**Files:**
- Modify: `apps/web/src/api/mutations.ts` (add `useDeleteIssue`, `useAddComment`)
- Create: `apps/web/src/pages/IssuePage.tsx`, `apps/web/src/pages/IssuePage.module.css`
- Modify: `apps/web/src/App.tsx` (route `issue/:issueKey`)
- Test: `apps/web/src/pages/IssuePage.test.tsx`

**Interfaces:**
- Consumes: `useIssue`, `useTeams`, `useUpdateIssue`, `ApiError`, all pickers incl. `DueDateField` and `EstimatePicker`, `describeActivity`, `formatShortDate`, `useNewIssue`.
- Produces:
  - `useDeleteIssue()` — `mutate(id)`; invalidates issue data except detail queries
  - `useAddComment()` — `mutate({ issueId, body })`; invalidates `issue` and `inbox`
  - Page: textbox "Issue title" (save on blur/Enter, Escape reverts), textbox "Description" (save on blur), Sub-issues section with "Add sub-issue", Activity section with events (`<actor> <describeActivity> · <date>`) and comments, textbox "Comment" + "Comment" button (⌘/Ctrl+Enter submits), aside "Issue properties", "Delete" button (confirm)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/IssuePage.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

const lastPatch = () => mock.requests.filter((r) => r.method === 'PATCH').at(-1);

describe('IssuePage', () => {
  it('shows the issue, its properties and activity', async () => {
    renderApp('/issue/DEV-1');
    expect(await screen.findByRole('textbox', { name: 'Issue title' })).toHaveValue('Crash on upload');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Uploads over 25 MB crash the app.');
    const props = screen.getByRole('complementary', { name: 'Issue properties' });
    expect(within(props).getByRole('button', { name: 'Status: In Progress' })).toBeInTheDocument();
    expect(within(props).getByRole('button', { name: 'Priority: Urgent' })).toBeInTheDocument();
    expect(await within(props).findByRole('button', { name: 'Project: Mobile app 2.0' })).toBeInTheDocument();
    expect(await within(props).findByRole('button', { name: 'Cycle: Cycle 14' })).toBeInTheDocument();
    expect(screen.getByText('created the issue · Oct 7', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('moved to In Progress', { exact: false })).toBeInTheDocument();
  });

  it('saves the title on blur', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const title = await screen.findByRole('textbox', { name: 'Issue title' });
    await user.clear(title);
    await user.type(title, 'Crash on big upload');
    await user.tab();
    await waitFor(() => expect(lastPatch()?.body).toEqual({ title: 'Crash on big upload' }));
  });

  it('does not save a blank title', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const title = await screen.findByRole('textbox', { name: 'Issue title' });
    await user.clear(title);
    await user.tab();
    expect(title).toHaveValue('Crash on upload');
    expect(lastPatch()).toBeUndefined();
  });

  it('saves the description on blur', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.type(description, ' Steps below.');
    await user.tab();
    await waitFor(() =>
      expect(lastPatch()?.body).toEqual({ description: 'Uploads over 25 MB crash the app. Steps below.' }),
    );
  });

  it('changes a property from the panel', async () => {
    const { user } = renderApp('/issue/DEV-1');
    const props = await screen.findByRole('complementary', { name: 'Issue properties' });
    await user.click(within(props).getByRole('button', { name: 'Estimate: No estimate' }));
    await user.click(screen.getByRole('option', { name: '3 points' }));
    await waitFor(() => expect(lastPatch()?.body).toEqual({ estimate: 3 }));
  });

  it('posts a comment', async () => {
    const { user } = renderApp('/issue/DEV-1');
    await user.type(await screen.findByRole('textbox', { name: 'Comment' }), 'Looks good');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(await screen.findByText('Looks good')).toBeInTheDocument();
    expect(mock.requests.find((r) => r.path === '/api/issues/i-1/comments')?.body).toEqual({ body: 'Looks good' });
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveValue('');
  });

  it('creates a sub-issue with the parent context', async () => {
    const { user } = renderApp('/issue/DEV-1');
    await user.click(await screen.findByRole('button', { name: 'Add sub-issue' }));
    const dialog = screen.getByRole('dialog', { name: 'New issue' });
    expect(within(dialog).getByRole('combobox', { name: 'Team' })).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Issue title' }), 'Child');
    await user.click(within(dialog).getByRole('button', { name: 'Create issue' }));
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'POST' && r.path === '/api/issues')?.body).toMatchObject({
        parentId: 'i-1',
        projectId: 'p-mobile',
        cycleId: 'c-14',
        teamId: 't-dev',
      }),
    );
  });

  it('deletes after confirmation and returns to the team list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp('/issue/DEV-1');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('tab', { name: 'All issues' })).toBeInTheDocument();
    expect(mock.requests.some((r) => r.method === 'DELETE' && r.path === '/api/issues/i-1')).toBe(true);
    vi.restoreAllMocks();
  });

  it.each(['/issue/DEV-999', '/issue/garbage'])('shows "Issue not found" for %s', async (route) => {
    renderApp(route);
    expect(await screen.findByText('Issue not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test IssuePage`
Expected: FAIL — "Page not found".

- [ ] **Step 3: Mutations**

Append to `apps/web/src/api/mutations.ts`:
```ts
export function useDeleteIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteIssue,
    // Detail queries are left alone so the open page does not refetch a 404 before navigating away.
    onSuccess: () => invalidateIssueData(qc, ISSUE_DATA_KEYS.filter((key) => key !== 'issue')),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) => api.addComment(issueId, body),
    onSuccess: () => invalidateIssueData(qc, ['issue', 'inbox']),
  });
}
```

- [ ] **Step 4: The page**

`apps/web/src/pages/IssuePage.module.css`:
```css
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
}
.article {
  flex: 999 1 480px;
  min-width: 0;
  padding: 40px 48px;
}
@media (max-width: 760px) {
  .article {
    padding: 24px 16px;
  }
}
.content {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.title {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
  outline: none;
}
.description {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-body);
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
}
.parentLink {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}
.subissues {
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.subHeader {
  height: 36px;
  padding: 0 8px 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--group-bg);
}
.subHeader + .subRow {
  border-top: 1px solid var(--panel-border);
}
.subTitle {
  font-weight: 500;
}
.spacer {
  flex: 1;
}
.subRow {
  height: 38px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--divider-soft);
}
.subRow:last-child {
  border-bottom: 0;
}
.subRow:hover {
  background: var(--surface-hover);
}
.subKey {
  width: 64px;
  flex: none;
}
.subName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.subDone {
  color: var(--text-muted);
  text-decoration: line-through;
}
.activity {
  padding-top: 12px;
  border-top: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.activityTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.event {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
}
.eventIcon {
  width: 20px;
  height: 20px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.actor {
  color: var(--text);
}
.comment {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}
.commentHead {
  display: flex;
  align-items: center;
  gap: 8px;
}
.commentAuthor {
  font-weight: 500;
}
.commentBody {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-body);
  white-space: pre-wrap;
}
.commentBox {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}
.commentBox textarea {
  border: 0;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}
.commentActions {
  display: flex;
  justify-content: flex-end;
}
.props {
  flex: 1 1 280px;
  padding: 20px 16px;
  border-left: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.propsTitle {
  padding: 0 8px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.propRow {
  min-height: 34px;
  padding-left: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.propLabel {
  width: 88px;
  flex: none;
  color: var(--text-muted);
}
.propValue {
  flex: 1;
  min-width: 0;
  display: flex;
}
```

`apps/web/src/pages/IssuePage.tsx`:
```tsx
import type { ActivityEntry, CommentDto, IssueDetail, IssueStatus, IssueUpdateInput } from '@tm/shared';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useAddComment, useDeleteIssue, useUpdateIssue } from '../api/mutations';
import { useIssue, useTeams } from '../api/queries';
import { PlusIcon, StatusIcon, TrashIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import {
  AssigneePicker,
  CyclePicker,
  DueDateField,
  EstimatePicker,
  LabelsPicker,
  PriorityPicker,
  ProjectPicker,
  StatusPicker,
} from '../components/pickers';
import { Avatar, TeamCrumb } from '../components/primitives';
import { ErrorState, ListSkeleton } from '../components/states';
import { describeActivity } from '../lib/activityText';
import { cx } from '../lib/cx';
import { formatShortDate } from '../lib/format';
import { useNewIssue } from '../lib/newIssue';
import styles from './IssuePage.module.css';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function IssuePage() {
  const { issueKey = '' } = useParams();
  const query = useIssue(issueKey);
  if (query.isPending) return <ListSkeleton />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <NotFound title="Issue not found" />
    ) : (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  return <IssueDetailView issue={query.data} />;
}

function IssueDetailView({ issue }: { issue: IssueDetail }) {
  const update = useUpdateIssue();
  const remove = useDeleteIssue();
  const navigate = useNavigate();
  const newIssue = useNewIssue();
  const { data: teams = [] } = useTeams();
  const team = teams.find((t) => t.id === issue.teamId);
  const save = (patch: IssueUpdateInput) => update.mutate({ id: issue.id, patch });

  const onDelete = () => {
    if (!window.confirm(`Delete ${issue.key}? This cannot be undone.`)) return;
    remove.mutate(issue.id, { onSuccess: () => navigate(team ? `/team/${team.key}/issues` : '/') });
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { label: team ? <TeamCrumb team={team} /> : '…', to: team ? `/team/${team.key}/issues` : undefined },
          { label: <span className="mono">{issue.key}</span> },
        ]}
      >
        <div className={page.spacer} />
        <button type="button" className="btn" onClick={onDelete}>
          <TrashIcon />
          Delete
        </button>
      </PageHeader>
      <div className={styles.body}>
        <article className={styles.article}>
          <div className={styles.content}>
            <TitleEditor key={issue.title} value={issue.title} onSave={(title) => save({ title })} />
            <DescriptionEditor key={issue.id} value={issue.description} onSave={(description) => save({ description })} />
            {issue.parent && (
              <Link className={styles.parentLink} to={`/issue/${issue.parent.key}`}>
                Sub-issue of <StatusIcon status={issue.parent.status} />
                <span className="mono">{issue.parent.key}</span>
                {issue.parent.title}
              </Link>
            )}
            <SubIssues
              issue={issue}
              onAdd={() =>
                newIssue.open({
                  teamId: issue.teamId,
                  parentId: issue.id,
                  projectId: issue.projectId,
                  cycleId: issue.cycleId,
                })
              }
            />
            <ActivityFeed issue={issue} />
          </div>
        </article>
        <PropertiesPanel issue={issue} onChange={save} />
      </div>
    </>
  );
}

function TitleEditor({ value, onSave }: { value: string; onSave: (title: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const title = draft.trim();
    if (!title) {
      setDraft(value);
      return;
    }
    if (title !== value) onSave(title);
  };
  return (
    <input
      className={styles.title}
      aria-label="Issue title"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}

function DescriptionEditor({ value, onSave }: { value: string; onSave: (description: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <textarea
      className={styles.description}
      aria-label="Description"
      placeholder="Add description…"
      rows={Math.max(3, draft.split('\n').length + 1)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
    />
  );
}

function SubIssues({ issue, onAdd }: { issue: IssueDetail; onAdd: () => void }) {
  const done = issue.children.filter((c) => c.status === 'done').length;
  return (
    <section className={styles.subissues} aria-label="Sub-issues">
      <div className={styles.subHeader}>
        <span className={styles.subTitle}>Sub-issues</span>
        {issue.children.length > 0 && (
          <span className="muted">
            {done}/{issue.children.length}
          </span>
        )}
        <span className={styles.spacer} />
        <button type="button" className="icon-btn" aria-label="Add sub-issue" onClick={onAdd}>
          <PlusIcon />
        </button>
      </div>
      {issue.children.map((child) => (
        <Link key={child.id} to={`/issue/${child.key}`} className={styles.subRow}>
          <StatusIcon status={child.status} />
          <span className={cx('mono muted', styles.subKey)}>{child.key}</span>
          <span className={cx(styles.subName, child.status === 'done' && styles.subDone)}>{child.title}</span>
          <Avatar user={child.assignee} size={18} />
        </Link>
      ))}
    </section>
  );
}

type Entry = { kind: 'event'; at: string; event: ActivityEntry } | { kind: 'comment'; at: string; comment: CommentDto };

function ActivityFeed({ issue }: { issue: IssueDetail }) {
  const entries: Entry[] = [
    ...issue.activity
      .filter((a) => a.type !== 'comment')
      .map((event): Entry => ({ kind: 'event', at: event.createdAt, event })),
    ...issue.comments.map((comment): Entry => ({ kind: 'comment', at: comment.createdAt, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section className={styles.activity} aria-label="Activity">
      <h2 className={styles.activityTitle}>Activity</h2>
      {entries.map((entry) =>
        entry.kind === 'event' ? (
          <div key={entry.event.id} className={styles.event}>
            {entry.event.type === 'status' ? (
              <span className={styles.eventIcon}>
                <StatusIcon status={(entry.event.payload as { to: IssueStatus }).to} />
              </span>
            ) : (
              <Avatar user={entry.event.actor} size={20} />
            )}
            <span>
              <span className={styles.actor}>{entry.event.actor.name}</span> {describeActivity(entry.event)} ·{' '}
              {formatShortDate(entry.event.createdAt)}
            </span>
          </div>
        ) : (
          <div key={entry.comment.id} className={styles.comment}>
            <div className={styles.commentHead}>
              <Avatar user={entry.comment.author} size={20} />
              <span className={styles.commentAuthor}>{entry.comment.author.name}</span>
              <span className="muted">{formatShortDate(entry.comment.createdAt)}</span>
            </div>
            <div className={styles.commentBody}>{entry.comment.body}</div>
          </div>
        ),
      )}
      <CommentBox issueId={issue.id} />
    </section>
  );
}

function CommentBox({ issueId }: { issueId: string }) {
  const [body, setBody] = useState('');
  const add = useAddComment();
  const submit = () => {
    const text = body.trim();
    if (!text || add.isPending) return;
    add.mutate({ issueId, body: text }, { onSuccess: () => setBody('') });
  };
  return (
    <form
      className={styles.commentBox}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label="Comment"
        rows={3}
        placeholder="Leave a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className={styles.commentActions}>
        <button type="submit" className="btn btn-primary" disabled={!body.trim() || add.isPending}>
          Comment
        </button>
      </div>
    </form>
  );
}

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.propRow}>
      <span className={styles.propLabel}>{label}</span>
      <div className={styles.propValue}>{children}</div>
    </div>
  );
}

function PropertiesPanel({ issue, onChange }: { issue: IssueDetail; onChange: (patch: IssueUpdateInput) => void }) {
  return (
    <aside className={styles.props} aria-label="Issue properties">
      <div className={styles.propsTitle}>Properties</div>
      <PropRow label="Status">
        <StatusPicker variant="full" value={issue.status} onChange={(status) => onChange({ status })} />
      </PropRow>
      <PropRow label="Priority">
        <PriorityPicker variant="full" value={issue.priority} onChange={(priority) => onChange({ priority })} />
      </PropRow>
      <PropRow label="Assignee">
        <AssigneePicker
          variant="full"
          value={issue.assignee?.id ?? null}
          fallback={issue.assignee}
          onChange={(assigneeId) => onChange({ assigneeId })}
        />
      </PropRow>
      <PropRow label="Labels">
        <LabelsPicker teamId={issue.teamId} value={issue.labels.map((l) => l.id)} onChange={(labelIds) => onChange({ labelIds })} />
      </PropRow>
      <PropRow label="Project">
        <ProjectPicker teamId={issue.teamId} value={issue.projectId} onChange={(projectId) => onChange({ projectId })} />
      </PropRow>
      <PropRow label="Cycle">
        <CyclePicker teamId={issue.teamId} value={issue.cycleId} onChange={(cycleId) => onChange({ cycleId })} />
      </PropRow>
      <PropRow label="Due date">
        <DueDateField value={issue.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
      </PropRow>
      <PropRow label="Estimate">
        <EstimatePicker value={issue.estimate} onChange={(estimate) => onChange({ estimate })} />
      </PropRow>
    </aside>
  );
}
```

In `apps/web/src/App.tsx` add `import { IssuePage } from './pages/IssuePage';` and the route:
```tsx
        <Route path="issue/:issueKey" element={<IssuePage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): issue detail with inline editing, sub-issues, activity and comments"
```

---

### Task 15: My issues and Inbox

**Files:**
- Modify: `apps/web/src/api/mutations.ts` (add `useMarkRead`)
- Create: `apps/web/src/pages/MyIssuesPage.tsx`, `apps/web/src/pages/InboxPage.tsx`, `apps/web/src/pages/InboxPage.module.css`
- Modify: `apps/web/src/App.tsx` (routes `my-issues`, `inbox`)
- Test: `apps/web/src/pages/MyIssuesPage.test.tsx`, `apps/web/src/pages/InboxPage.test.tsx`

**Interfaces:**
- Consumes: `useIssues`, `useInbox(userId)`, `useCurrentUser`, `IssueQueryList`, `DisplayMenu`, `useDensity`, `describeActivity`, `formatShortDate`.
- Produces: `useMarkRead(userId)` — `mutate(input: InboxReadInput)`, optimistic on `qk.inbox(userId)`; `MyIssuesPage` (query scope = current user id); `InboxPage` (one `button` per item, unread items carry an element labelled "Unread", "Mark all as read" button).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/MyIssuesPage.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

describe('MyIssuesPage', () => {
  it("shows the current user's issues and follows user switches", async () => {
    const { user } = renderApp('/my-issues');
    expect(await screen.findByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Offline sync' })).not.toBeInTheDocument();
    expect(mock.requests.find((r) => r.path === '/api/issues?mine=true')?.userId).toBe('u-anna');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Current user' }), 'Max Kim');
    expect(await screen.findByRole('link', { name: 'Offline sync' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Crash on upload' })).not.toBeInTheDocument());
  });
});
```

`apps/web/src/pages/InboxPage.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

describe('InboxPage', () => {
  it('lists notifications with unread markers', async () => {
    renderApp('/inbox');
    expect(await screen.findByRole('button', { name: /Crash on upload/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faster search/ })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Unread')).toHaveLength(2);
    expect(screen.getByText('Max Kim moved to In Progress')).toBeInTheDocument();
  });

  it('marks an item read and opens the issue', async () => {
    const { user } = renderApp('/inbox');
    await user.click(await screen.findByRole('button', { name: /Crash on upload/ }));
    expect(await screen.findByRole('textbox', { name: 'Issue title' })).toHaveValue('Crash on upload');
    expect(mock.requests.find((r) => r.path === '/api/inbox/read')?.body).toEqual({ activityIds: ['a-status-1'] });
  });

  it('marks everything as read', async () => {
    const { user } = renderApp('/inbox');
    await screen.findByLabelText('2 unread');
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.queryAllByLabelText('Unread')).toHaveLength(0));
    await waitFor(() => expect(screen.queryByLabelText('2 unread')).not.toBeInTheDocument());
    expect(mock.requests.find((r) => r.path === '/api/inbox/read')?.body).toEqual({ all: true });
  });

  it('shows an empty state when there is nothing new', async () => {
    localStorage.setItem('tm.currentUserId', 'u-max');
    renderApp('/inbox');
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test MyIssuesPage InboxPage`
Expected: FAIL — "Page not found".

- [ ] **Step 3: Mutation**

Append to `apps/web/src/api/mutations.ts` (add `InboxReadInput`, `InboxResponse` to the `@tm/shared` type import):
```ts
export function useMarkRead(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InboxReadInput) => api.markRead(input),
    onMutate: async (input) => {
      const key = qk.inbox(userId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InboxResponse>(key);
      if (previous) {
        const ids = 'all' in input ? null : new Set(input.activityIds);
        const items = previous.items.map((item) =>
          ids === null || ids.has(item.activity.id) ? { ...item, read: true } : item,
        );
        qc.setQueryData<InboxResponse>(key, { items, unreadCount: items.filter((i) => !i.read).length });
      }
      return { key, previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(context.key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}
```

- [ ] **Step 4: Pages**

`apps/web/src/pages/MyIssuesPage.tsx`:
```tsx
import { useIssues } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader } from '../components/PageHeader';
import { useCurrentUser } from '../lib/currentUser';
import { useDensity } from '../lib/useDensity';
import page from './page.module.css';

export function MyIssuesPage() {
  const { user } = useCurrentUser();
  const [density, setDensity] = useDensity();
  const issues = useIssues({ mine: true }, { scope: user?.id ?? '', enabled: !!user });
  return (
    <>
      <PageHeader crumbs={[{ label: 'My issues' }]}>
        <div className={page.spacer} />
        <DisplayMenu value={density} onChange={setDensity} />
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues assigned to you" />
      </div>
    </>
  );
}
```

`apps/web/src/pages/InboxPage.module.css`:
```css
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  position: relative;
  width: 100%;
  min-height: 56px;
  padding: 8px 16px 8px 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 0;
  border-bottom: 1px solid var(--divider-soft);
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.item:hover {
  background: var(--surface-hover);
}
.dot {
  position: absolute;
  left: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.issueLine {
  display: flex;
  gap: 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.read .issueLine {
  color: var(--text-muted);
}
.what {
  font-size: 12px;
  color: var(--text-muted);
}
```

`apps/web/src/pages/InboxPage.tsx`:
```tsx
import type { InboxItem } from '@tm/shared';
import { useNavigate } from 'react-router';
import { useMarkRead } from '../api/mutations';
import { useInbox } from '../api/queries';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import { describeActivity } from '../lib/activityText';
import { useCurrentUser } from '../lib/currentUser';
import { cx } from '../lib/cx';
import { formatShortDate } from '../lib/format';
import styles from './InboxPage.module.css';
import page from './page.module.css';

export function InboxPage() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const inbox = useInbox(userId);
  const markRead = useMarkRead(userId);
  const navigate = useNavigate();

  const open = (item: InboxItem) => {
    if (!item.read) markRead.mutate({ activityIds: [item.activity.id] });
    navigate(`/issue/${item.issue.key}`);
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Inbox' }]}>
        <div className={page.spacer} />
        <button
          type="button"
          className="btn"
          disabled={!inbox.data?.unreadCount}
          onClick={() => markRead.mutate({ all: true })}
        >
          Mark all as read
        </button>
      </PageHeader>
      <div className={page.scroll}>
        {inbox.isPending ? (
          <ListSkeleton />
        ) : inbox.isError ? (
          <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
        ) : inbox.data.items.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="Updates on issues you created or are assigned to will show up here."
          />
        ) : (
          <ul className={styles.list}>
            {inbox.data.items.map((item) => (
              <li key={item.activity.id}>
                <button type="button" className={cx(styles.item, item.read && styles.read)} onClick={() => open(item)}>
                  {!item.read && <span className={styles.dot} role="img" aria-label="Unread" />}
                  <Avatar user={item.activity.actor} size={22} />
                  <span className={styles.text}>
                    <span className={styles.issueLine}>
                      <span className="mono muted">{item.issue.key}</span>
                      {item.issue.title}
                    </span>
                    <span className={styles.what}>
                      {item.activity.actor.name} {describeActivity(item.activity)}
                    </span>
                  </span>
                  <span className="muted">{formatShortDate(item.activity.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

In `apps/web/src/App.tsx` add imports for `MyIssuesPage` and `InboxPage` and the routes:
```tsx
        <Route path="my-issues" element={<MyIssuesPage />} />
        <Route path="inbox" element={<InboxPage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): my issues and inbox with read tracking"
```

---

### Task 16: Projects, cycles and saved views pages

**Files:**
- Modify: `apps/web/src/api/mutations.ts` (add `useCreateProject`, `useUpdateView`, `useDeleteView`)
- Create: `apps/web/src/pages/lists.module.css`, `ProjectsPage.tsx`, `ProjectPage.tsx`, `CyclesPage.tsx`, `CyclePage.tsx`, `ViewsPage.tsx`, `ViewPage.tsx`
- Modify: `apps/web/src/App.tsx` (routes `projects`, `projects/:id`, `team/:teamKey/cycles`, `cycles/:id`, `views`, `views/:id`)
- Test: `apps/web/src/pages/ProjectsPage.test.tsx`, `CyclesPage.test.tsx`, `ViewsPage.test.tsx`

**Interfaces:**
- Consumes: `useProjects`, `useProject`, `useCycles`, `useCycle`, `useViews`, `useView`, `useIssues`, `useTeams`, `useTeamByKey`, `IssueQueryList`, `FilterMenu`, `DisplayMenu`, `Progress`, `stripTeam`, `countFilters`, `formatRange`, `ApiError`.
- Produces: `useCreateProject()`, `useUpdateView(id)` (`mutate(input: ViewUpdateInput)`), `useDeleteView()` (`mutate(id)`); the six pages above. ViewPage has a textbox "View name" (save on blur/Enter) and a "Delete" button.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/ProjectsPage.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

describe('ProjectsPage', () => {
  it('lists projects with progress and opens a project', async () => {
    const { user } = renderApp('/projects');
    const link = await screen.findByRole('link', { name: /Mobile app 2.0/ });
    expect(screen.getByLabelText('0 of 1 done')).toBeInTheDocument();
    await user.click(link);
    expect(await screen.findByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Offline sync' })).not.toBeInTheDocument();
    expect(mock.requests.some((r) => r.path === '/api/issues?projectId=p-mobile')).toBe(true);
  });

  it('creates a project', async () => {
    const { user } = renderApp('/projects');
    await screen.findByRole('link', { name: /Mobile app 2.0/ });
    await user.type(screen.getByRole('textbox', { name: 'New project name' }), 'Brand refresh');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('link', { name: /Brand refresh/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(mock.requests.find((r) => r.path === '/api/projects')?.body).toEqual({ teamId: 't-dev', name: 'Brand refresh' }),
    );
  });
});
```

`apps/web/src/pages/CyclesPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';

describe('CyclesPage', () => {
  it("lists the team's cycles and opens one", async () => {
    const { user } = renderApp('/team/DEV/cycles');
    const link = await screen.findByRole('link', { name: /Cycle 14/ });
    expect(link).toHaveTextContent('Oct 6–19');
    await user.click(link);
    expect(await screen.findByRole('link', { name: 'Crash on upload' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Offline sync' })).not.toBeInTheDocument();
  });
});
```

`apps/web/src/pages/ViewsPage.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/render';
import { mock } from '../test/server';

async function saveTodoView() {
  const utils = renderApp('/team/DEV/issues?status=todo');
  await screen.findByRole('link', { name: 'Export to CSV' });
  await utils.user.click(screen.getByRole('button', { name: /^Filter/ }));
  await utils.user.click(screen.getByRole('button', { name: 'Save as view' }));
  await utils.user.type(screen.getByRole('textbox', { name: 'View name' }), 'Todo only');
  await utils.user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'View name' })).toHaveValue('Todo only'));
  return utils;
}

describe('views', () => {
  it('shows an empty state without views', async () => {
    renderApp('/views');
    expect(await screen.findByText('No views yet')).toBeInTheDocument();
  });

  it('lands on the saved view showing its issues', async () => {
    await saveTodoView();
    expect(await screen.findByRole('link', { name: 'Export to CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Crash on upload' })).not.toBeInTheDocument();
  });

  it('renames a view', async () => {
    const { user } = await saveTodoView();
    const name = screen.getByRole('textbox', { name: 'View name' });
    await user.clear(name);
    await user.type(name, 'Renamed{Enter}');
    await waitFor(() =>
      expect(mock.requests.find((r) => r.method === 'PATCH' && r.path === '/api/views/v-1')?.body).toEqual({ name: 'Renamed' }),
    );
  });

  it('deletes a view and returns to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = await saveTodoView();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No views yet')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('lists saved views', async () => {
    const { user } = await saveTodoView();
    // The sidebar "Views" link renders before the breadcrumb link with the same name.
    await user.click(screen.getAllByRole('link', { name: 'Views' })[0]);
    expect(await screen.findByRole('link', { name: /Todo only/ })).toBeInTheDocument();
  });

  it('shows not found for an unknown view', async () => {
    renderApp('/views/v-404');
    expect(await screen.findByText('View not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tm/web test ProjectsPage CyclesPage ViewsPage`
Expected: FAIL — "Page not found" / view page missing.

- [ ] **Step 3: Mutations**

Append to `apps/web/src/api/mutations.ts` (add `ViewUpdateInput` to the `@tm/shared` type import):
```ts
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createProject, onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }) });
}

export function useUpdateView(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ViewUpdateInput) => api.updateView(id, input),
    onSuccess: (view) => {
      qc.setQueryData(qk.view(id), view);
      void qc.invalidateQueries({ queryKey: qk.views });
    },
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteView, onSuccess: () => qc.invalidateQueries({ queryKey: qk.views }) });
}
```

- [ ] **Step 4: Pages**

`apps/web/src/pages/lists.module.css`:
```css
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  min-height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--divider-soft);
  color: var(--text);
}
.row:hover {
  background: var(--surface-hover);
}
.name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.badge {
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  border-radius: 10px;
  background: rgba(94, 99, 230, 0.18);
  color: #b9bbf6;
  font-size: 11px;
}
.toolbar {
  padding: 12px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--divider);
}
.toolbar input {
  flex: 1;
  min-width: 160px;
}
.nameInput {
  min-width: 80px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-weight: 500;
  outline: none;
}
.nameInput:focus {
  box-shadow: 0 1px 0 var(--accent);
}
```

`apps/web/src/pages/ProjectsPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCreateProject } from '../api/mutations';
import { useProjects, useTeams } from '../api/queries';
import { ProjectIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Progress, TeamCrumb } from '../components/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import styles from './lists.module.css';
import page from './page.module.css';

export function ProjectsPage() {
  const [sp] = useSearchParams();
  const teamId = sp.get('teamId') ?? undefined;
  const { data: teams = [] } = useTeams();
  const projects = useProjects(teamId);
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const team = teams.find((t) => t.id === teamId);
  const targetTeamId = teamId ?? (newTeamId || teams[0]?.id || '');

  return (
    <>
      <PageHeader
        crumbs={
          team
            ? [{ label: <TeamCrumb team={team} />, to: `/team/${team.key}/issues` }, { label: 'Projects' }]
            : [{ label: 'Projects' }]
        }
      />
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !targetTeamId) return;
          create.mutate({ teamId: targetTeamId, name: name.trim() }, { onSuccess: () => setName('') });
        }}
      >
        {!teamId && (
          <select className="input" aria-label="Team" value={targetTeamId} onChange={(e) => setNewTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <input
          className="input"
          placeholder="New project name"
          aria-label="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create project
        </button>
      </form>
      <div className={page.scroll}>
        {projects.isPending ? (
          <ListSkeleton />
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.data.length === 0 ? (
          <EmptyState title="No projects yet" description="Create one above to group related issues." />
        ) : (
          <ul className={styles.list}>
            {projects.data.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className={styles.row}>
                  <span className={styles.name}>
                    <ProjectIcon className="muted" />
                    {project.name}
                  </span>
                  <span className="muted">{teams.find((t) => t.id === project.teamId)?.name}</span>
                  <span className={page.spacer} />
                  <Progress done={project.doneCount} total={project.issueCount} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

`apps/web/src/pages/ProjectPage.tsx`:
```tsx
import { useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useIssues, useProject } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader } from '../components/PageHeader';
import { Progress } from '../components/primitives';
import { ErrorState, ListSkeleton } from '../components/states';
import { useDensity } from '../lib/useDensity';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function ProjectPage() {
  const { id = '' } = useParams();
  const project = useProject(id);
  const issues = useIssues({ projectId: id });
  const [density, setDensity] = useDensity();

  if (project.isPending) return <ListSkeleton />;
  if (project.isError) {
    return project.error instanceof ApiError && project.error.status === 404 ? (
      <NotFound title="Project not found" />
    ) : (
      <ErrorState error={project.error} />
    );
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.data.name }]}>
        <div className={page.spacer} />
        <div className={page.actions}>
          <Progress done={project.data.doneCount} total={project.data.issueCount} />
          <DisplayMenu value={density} onChange={setDensity} />
        </div>
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues in this project" />
      </div>
    </>
  );
}
```

`apps/web/src/pages/CyclesPage.tsx`:
```tsx
import { Link, useParams } from 'react-router';
import { useCycles, useTeamByKey } from '../api/queries';
import { PageHeader } from '../components/PageHeader';
import { Progress, TeamCrumb } from '../components/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import { formatRange } from '../lib/format';
import styles from './lists.module.css';
import { NotFound } from './NotFound';
import page from './page.module.css';

const today = () => new Date().toISOString().slice(0, 10);

export function CyclesPage() {
  const { teamKey = '' } = useParams();
  const { team, isLoading } = useTeamByKey(teamKey);
  const cycles = useCycles(team?.id);

  if (isLoading) return <ListSkeleton />;
  if (!team) return <NotFound title="Team not found" />;

  const now = today();
  return (
    <>
      <PageHeader crumbs={[{ label: <TeamCrumb team={team} />, to: `/team/${team.key}/issues` }, { label: 'Cycles' }]} />
      <div className={page.scroll}>
        {cycles.isPending ? (
          <ListSkeleton />
        ) : cycles.isError ? (
          <ErrorState error={cycles.error} onRetry={() => void cycles.refetch()} />
        ) : cycles.data.length === 0 ? (
          <EmptyState title="No cycles yet" />
        ) : (
          <ul className={styles.list}>
            {[...cycles.data]
              .sort((a, b) => b.number - a.number)
              .map((cycle) => (
                <li key={cycle.id}>
                  <Link to={`/cycles/${cycle.id}`} className={styles.row}>
                    <span className={styles.name}>Cycle {cycle.number}</span>
                    <span className="muted">{formatRange(cycle.startsOn, cycle.endsOn)}</span>
                    {cycle.startsOn <= now && now <= cycle.endsOn && <span className={styles.badge}>Current</span>}
                    <span className={page.spacer} />
                    <Progress done={cycle.doneCount} total={cycle.issueCount} />
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

`apps/web/src/pages/CyclePage.tsx`:
```tsx
import { useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useCycle, useIssues, useTeams } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader, type Crumb } from '../components/PageHeader';
import { Progress, TeamCrumb } from '../components/primitives';
import { ErrorState, ListSkeleton } from '../components/states';
import { formatRange } from '../lib/format';
import { useDensity } from '../lib/useDensity';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function CyclePage() {
  const { id = '' } = useParams();
  const cycle = useCycle(id);
  const issues = useIssues({ cycleId: id });
  const { data: teams = [] } = useTeams();
  const [density, setDensity] = useDensity();

  if (cycle.isPending) return <ListSkeleton />;
  if (cycle.isError) {
    return cycle.error instanceof ApiError && cycle.error.status === 404 ? (
      <NotFound title="Cycle not found" />
    ) : (
      <ErrorState error={cycle.error} />
    );
  }

  const team = teams.find((t) => t.id === cycle.data.teamId);
  const crumbs: Crumb[] = team
    ? [
        { label: <TeamCrumb team={team} />, to: `/team/${team.key}/issues` },
        { label: 'Cycles', to: `/team/${team.key}/cycles` },
        { label: `Cycle ${cycle.data.number}` },
      ]
    : [{ label: `Cycle ${cycle.data.number}` }];

  return (
    <>
      <PageHeader crumbs={crumbs}>
        <span className="muted">{formatRange(cycle.data.startsOn, cycle.data.endsOn)}</span>
        <div className={page.spacer} />
        <div className={page.actions}>
          <Progress done={cycle.data.doneCount} total={cycle.data.issueCount} />
          <DisplayMenu value={density} onChange={setDensity} />
        </div>
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues in this cycle" />
      </div>
    </>
  );
}
```

`apps/web/src/pages/ViewsPage.tsx`:
```tsx
import { Link } from 'react-router';
import { useViews } from '../api/queries';
import { ViewsIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import { countFilters, stripTeam } from '../lib/filters';
import styles from './lists.module.css';
import page from './page.module.css';

export function ViewsPage() {
  const views = useViews();
  return (
    <>
      <PageHeader crumbs={[{ label: 'Views' }]} />
      <div className={page.scroll}>
        {views.isPending ? (
          <ListSkeleton />
        ) : views.isError ? (
          <ErrorState error={views.error} onRetry={() => void views.refetch()} />
        ) : views.data.length === 0 ? (
          <EmptyState title="No views yet" description="Use Filter → Save as view on any issue list to keep a filter here." />
        ) : (
          <ul className={styles.list}>
            {views.data.map((view) => {
              const n = countFilters(stripTeam(view.filters));
              return (
                <li key={view.id}>
                  <Link to={`/views/${view.id}`} className={styles.row}>
                    <span className={styles.name}>
                      <ViewsIcon className="muted" />
                      {view.name}
                    </span>
                    <span className="muted">
                      {n} {n === 1 ? 'filter' : 'filters'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
```

`apps/web/src/pages/ViewPage.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useDeleteView, useUpdateView } from '../api/mutations';
import { useIssues, useView } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { FilterMenu } from '../components/FilterMenu';
import { TrashIcon } from '../components/icons';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, ListSkeleton } from '../components/states';
import { stripTeam } from '../lib/filters';
import { useDensity } from '../lib/useDensity';
import styles from './lists.module.css';
import { NotFound } from './NotFound';
import page from './page.module.css';

function NameEditor({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const name = draft.trim();
    if (!name) setDraft(value);
    else if (name !== value) onSave(name);
  };
  return (
    <input
      className={styles.nameInput}
      aria-label="View name"
      value={draft}
      size={Math.max(8, draft.length)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}

export function ViewPage() {
  const { id = '' } = useParams();
  const view = useView(id);
  const issues = useIssues(view.data?.filters ?? {}, { enabled: !!view.data });
  const update = useUpdateView(id);
  const remove = useDeleteView();
  const navigate = useNavigate();
  const [density, setDensity] = useDensity();

  if (view.isPending) return <ListSkeleton />;
  if (view.isError) {
    return view.error instanceof ApiError && view.error.status === 404 ? (
      <NotFound title="View not found" />
    ) : (
      <ErrorState error={view.error} />
    );
  }

  const { name, filters } = view.data;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Views', to: '/views' },
          { label: <NameEditor key={name} value={name} onSave={(next) => update.mutate({ name: next })} /> },
        ]}
      >
        <div className={page.spacer} />
        <div className={page.actions}>
          <FilterMenu
            teamId={filters.teamId}
            value={stripTeam(filters)}
            onChange={(next) => update.mutate({ filters: { ...next, teamId: filters.teamId } })}
          />
          <DisplayMenu value={density} onChange={setDensity} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm(`Delete view “${name}”?`)) remove.mutate(id, { onSuccess: () => navigate('/views') });
            }}
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues match this view" />
      </div>
    </>
  );
}
```

In `apps/web/src/App.tsx` import the six pages and add the routes before `*`:
```tsx
        <Route path="team/:teamKey/cycles" element={<CyclesPage />} />
        <Route path="cycles/:id" element={<CyclePage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectPage />} />
        <Route path="views" element={<ViewsPage />} />
        <Route path="views/:id" element={<ViewPage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tm/web test && pnpm --filter @tm/web typecheck`
Expected: all web tests PASS, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): projects, cycles and saved views pages"
```

---

### Task 17: README, lint, full verification and browser smoke test

**Files:**
- Create: `README.md`
- Modify: any file flagged by `pnpm lint` (fix, do not disable rules)

- [ ] **Step 1: Write the README**

`README.md`:
````markdown
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
````

- [ ] **Step 2: Lint and fix**

Run: `pnpm lint`
Expected: exit 0. Fix every reported error in the code (typical: unused imports). Re-run until clean.

- [ ] **Step 3: Full verification**

Run: `pnpm typecheck && pnpm test`
Expected: all packages typecheck; shared, api and web test suites PASS. Record the test counts in the final report.

- [ ] **Step 4: Browser smoke test**

Run: `pnpm db:seed` then start `pnpm dev` in the background.

With the Playwright MCP tools:
1. Open `http://localhost:5173/` → redirected to `/team/DES/issues` or `/team/DEV/issues` (first team by name is Design). Navigate to `/team/DEV/issues`; take a screenshot; verify groups In Progress / In Review / Todo / Backlog / Done and DEV-151, DEV-142 rows; console has no errors.
2. Switch to Board (`/team/DEV/board`); screenshot; drag DEV-160 from Todo to In Progress; reload and confirm it stayed in In Progress.
3. Open `/issue/DEV-142`; screenshot; verify description, sub-issues DEV-143/144/145, Max Kim's comment, properties (In Progress, High, Anna Romanova, Feature + Mobile, Mobile app 2.0, Cycle 14, due date, 5 points). Post a comment and confirm it appears.
4. Open `/inbox` as Anna → 3 items (or fewer if read earlier); open one, return, it is no longer unread.
5. Resize to 390×844; screenshot the list page; verify no horizontal page scroll and that the sidebar stacks above the panel.

Compare the screenshots with the mockups (colors, fonts, spacing, icons); fix visible deviations, re-run `pnpm test`.

Stop the dev servers.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: README; chore: lint fixes after full verification"
```
