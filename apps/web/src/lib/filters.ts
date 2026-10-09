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
