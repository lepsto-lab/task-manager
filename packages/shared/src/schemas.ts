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
