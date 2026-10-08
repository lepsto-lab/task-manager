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
