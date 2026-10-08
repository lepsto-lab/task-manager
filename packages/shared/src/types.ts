import type { ActivityType, IssuePriority, IssueStatus } from './constants';

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  key: string;
  color: string;
}

export interface Label {
  id: string;
  teamId: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
  issueCount: number;
  doneCount: number;
}

export interface Cycle {
  id: string;
  teamId: string;
  number: number;
  startsOn: string;
  endsOn: string;
  issueCount: number;
  doneCount: number;
}

export interface ViewFilters {
  teamId?: string;
  status?: IssueStatus[];
  priority?: IssuePriority[];
  assigneeId?: string[];
  labelId?: string[];
  projectId?: string;
  cycleId?: string;
}

export interface IssueFilters extends ViewFilters {
  parentId?: string;
  mine?: boolean;
}

export interface IssueListItem {
  id: string;
  key: string;
  teamId: string;
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: User | null;
  labels: Label[];
  projectId: string | null;
  cycleId: string | null;
  parentId: string | null;
  dueDate: string | null;
  estimate: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDto {
  id: string;
  issueId: string;
  author: User;
  body: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  issueId: string;
  actor: User;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface IssueDetail extends IssueListItem {
  description: string;
  creator: User;
  project: { id: string; name: string } | null;
  cycle: { id: string; number: number; startsOn: string; endsOn: string } | null;
  parent: { id: string; key: string; title: string; status: IssueStatus } | null;
  children: IssueListItem[];
  comments: CommentDto[];
  activity: ActivityEntry[];
}

export interface InboxItem {
  read: boolean;
  activity: ActivityEntry;
  issue: { id: string; key: string; title: string; status: IssueStatus };
}

export interface InboxResponse {
  items: InboxItem[];
  unreadCount: number;
}

export interface View {
  id: string;
  name: string;
  filters: ViewFilters;
  createdAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
