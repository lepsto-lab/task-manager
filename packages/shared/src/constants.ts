export const ISSUE_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = ['none', 'urgent', 'high', 'medium', 'low'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  none: 'No priority',
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const LIST_STATUS_ORDER: readonly IssueStatus[] = ['in_progress', 'in_review', 'todo', 'backlog', 'done'];
export const BOARD_STATUS_ORDER: readonly IssueStatus[] = ISSUE_STATUSES;
export const ACTIVE_STATUSES: readonly IssueStatus[] = ['in_progress', 'in_review', 'todo'];

export const ACTIVITY_TYPES = [
  'created',
  'status',
  'priority',
  'assignee',
  'title',
  'labels',
  'project',
  'cycle',
  'due_date',
  'estimate',
  'parent',
  'comment',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ESTIMATE_OPTIONS: readonly number[] = [1, 2, 3, 5, 8];
