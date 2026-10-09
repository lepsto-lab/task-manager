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
  createdAt: createdAt(),
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
