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
