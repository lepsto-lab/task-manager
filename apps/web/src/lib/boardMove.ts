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

export function moveFromDragEnd(columns: Columns, activeId: string, overId: string) {
  return planMove(columns, activeId, overId);
}
