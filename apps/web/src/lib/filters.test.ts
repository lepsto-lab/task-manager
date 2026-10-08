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
