import type {
  ApiErrorBody,
  CommentDto,
  Cycle,
  InboxReadInput,
  InboxResponse,
  IssueCreateInput,
  IssueDetail,
  IssueFilters,
  IssueListItem,
  IssueUpdateInput,
  Label,
  Project,
  ProjectCreateInput,
  Team,
  User,
  View,
  ViewCreateInput,
  ViewUpdateInput,
} from '@tm/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let currentUserId: string | null = null;

export function setApiUser(id: string | null): void {
  currentUserId = id;
}

export function toQuery(params: object): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const query = sp.toString();
  return query ? `?${query}` : '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (currentUserId) headers['x-user-id'] = currentUserId;
  let res: Response;
  try {
    res = await fetch(new URL(`/api${path}`, window.location.origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Network error — is the API running?');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, error?.code ?? 'http_error', error?.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  users: () => request<User[]>('GET', '/users'),
  teams: () => request<Team[]>('GET', '/teams'),
  labels: (teamId?: string) => request<Label[]>('GET', `/labels${toQuery({ teamId })}`),
  projects: (teamId?: string) => request<Project[]>('GET', `/projects${toQuery({ teamId })}`),
  project: (id: string) => request<Project>('GET', `/projects/${id}`),
  createProject: (input: ProjectCreateInput) => request<Project>('POST', '/projects', input),
  cycles: (teamId?: string) => request<Cycle[]>('GET', `/cycles${toQuery({ teamId })}`),
  cycle: (id: string) => request<Cycle>('GET', `/cycles/${id}`),
  issues: (filters: IssueFilters) => request<IssueListItem[]>('GET', `/issues${toQuery(filters)}`),
  issue: (key: string) => request<IssueDetail>('GET', `/issues/${encodeURIComponent(key)}`),
  createIssue: (input: IssueCreateInput) => request<IssueDetail>('POST', '/issues', input),
  updateIssue: (id: string, patch: IssueUpdateInput) => request<IssueDetail>('PATCH', `/issues/${id}`, patch),
  deleteIssue: (id: string) => request<void>('DELETE', `/issues/${id}`),
  addComment: (issueId: string, body: string) =>
    request<CommentDto>('POST', `/issues/${issueId}/comments`, { body }),
  inbox: () => request<InboxResponse>('GET', '/inbox'),
  markRead: (input: InboxReadInput) => request<void>('POST', '/inbox/read', input),
  views: () => request<View[]>('GET', '/views'),
  view: (id: string) => request<View>('GET', `/views/${id}`),
  createView: (input: ViewCreateInput) => request<View>('POST', '/views', input),
  updateView: (id: string, input: ViewUpdateInput) => request<View>('PATCH', `/views/${id}`, input),
  deleteView: (id: string) => request<void>('DELETE', `/views/${id}`),
};
