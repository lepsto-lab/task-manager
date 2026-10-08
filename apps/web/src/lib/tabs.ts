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
