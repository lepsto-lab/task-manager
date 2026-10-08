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
