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
