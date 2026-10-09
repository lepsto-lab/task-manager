import type {
  ActivityEntry,
  CommentDto,
  Cycle,
  InboxItem,
  InboxReadInput,
  IssueCreateInput,
  IssueDetail,
  IssueListItem,
  IssuePriority,
  IssueStatus,
  IssueUpdateInput,
  Label,
  Project,
  Team,
  User,
  View,
  ViewCreateInput,
  ViewFilters,
  ViewUpdateInput,
} from '@tm/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const anna: User = { id: 'u-anna', name: 'Anna Romanova', initials: 'AR', color: '#6D4FC2' };
export const max: User = { id: 'u-max', name: 'Max Kim', initials: 'MK', color: '#2F7D6D' };
export const dev: Team = { id: 't-dev', name: 'Engineering', key: 'DEV', color: '#2F7D6D' };
export const des: Team = { id: 't-des', name: 'Design', key: 'DES', color: '#B5582F' };
export const bug: Label = { id: 'l-bug', teamId: dev.id, name: 'Bug', color: '#EB5757' };
export const feature: Label = { id: 'l-feat', teamId: dev.id, name: 'Feature', color: '#A78BFA' };
export const mobile: Project = {
  id: 'p-mobile',
  teamId: dev.id,
  name: 'Mobile app 2.0',
  createdAt: '2026-09-01T09:00:00.000Z',
  issueCount: 1,
  doneCount: 0,
};
export const cycle14: Cycle = {
  id: 'c-14',
  teamId: dev.id,
  number: 14,
  startsOn: '2026-10-06',
  endsOn: '2026-10-19',
  issueCount: 1,
  doneCount: 0,
};

const users = [anna, max];
const allLabels = [bug, feature];
const STAMP = '2026-10-07T12:00:00.000Z';

function makeIssue(
  n: number,
  title: string,
  status: IssueStatus,
  priority: IssuePriority,
  assignee: User | null,
  labels: Label[] = [],
  extra: Partial<IssueListItem> = {},
): IssueListItem {
  return {
    id: `i-${n}`,
    key: `DEV-${n}`,
    teamId: dev.id,
    number: n,
    title,
    status,
    priority,
    assignee,
    labels,
    projectId: null,
    cycleId: null,
    parentId: null,
    dueDate: null,
    estimate: null,
    sortOrder: n * 1000,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  };
}

interface MockState {
  issues: IssueListItem[];
  descriptions: Record<string, string>;
  comments: CommentDto[];
  activity: ActivityEntry[];
  inbox: Record<string, Omit<InboxItem, 'read'>[]>;
  reads: Set<string>;
  projects: Project[];
  views: View[];
  nextNumber: number;
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  userId: string | null;
}

function freshState(): MockState {
  const issues = [
    makeIssue(1, 'Crash on upload', 'in_progress', 'urgent', anna, [bug], { projectId: mobile.id, cycleId: cycle14.id }),
    makeIssue(2, 'Offline sync', 'in_review', 'high', max, [feature]),
    makeIssue(3, 'Export to CSV', 'todo', 'low', null),
    makeIssue(4, 'Calendar sync', 'backlog', 'none', max),
    makeIssue(5, 'Faster search', 'done', 'medium', anna),
  ];
  const statusEvent: ActivityEntry = {
    id: 'a-status-1',
    issueId: 'i-1',
    type: 'status',
    payload: { from: 'todo', to: 'in_progress' },
    createdAt: '2026-10-07T13:00:00.000Z',
    actor: max,
  };
  return {
    issues,
    descriptions: { 'i-1': 'Uploads over 25 MB crash the app.' },
    comments: [],
    activity: [
      ...issues.map<ActivityEntry>((i) => ({
        id: `a-created-${i.number}`,
        issueId: i.id,
        type: 'created',
        payload: {},
        createdAt: STAMP,
        actor: anna,
      })),
      statusEvent,
    ],
    inbox: {
      [anna.id]: [
        {
          activity: statusEvent,
          issue: { id: 'i-1', key: 'DEV-1', title: 'Crash on upload', status: 'in_progress' },
        },
        {
          activity: {
            id: 'a-prio-5',
            issueId: 'i-5',
            type: 'priority',
            payload: { from: 'low', to: 'medium' },
            createdAt: '2026-10-06T10:00:00.000Z',
            actor: max,
          },
          issue: { id: 'i-5', key: 'DEV-5', title: 'Faster search', status: 'done' },
        },
      ],
    },
    reads: new Set(),
    projects: [mobile],
    views: [],
    nextNumber: 6,
  };
}

export const mock = { state: freshState(), requests: [] as RecordedRequest[] };

export function resetMock() {
  mock.state = freshState();
  mock.requests = [];
}

function record(request: Request, body?: unknown) {
  const url = new URL(request.url);
  mock.requests.push({
    method: request.method,
    path: url.pathname + url.search,
    body,
    userId: request.headers.get('x-user-id'),
  });
}

const notFound = (what: string) =>
  HttpResponse.json({ error: { code: 'not_found', message: `${what} not found` } }, { status: 404 });

export function toDetail(issue: IssueListItem): IssueDetail {
  const s = mock.state;
  const parent = s.issues.find((i) => i.id === issue.parentId);
  return {
    ...issue,
    description: s.descriptions[issue.id] ?? '',
    creator: anna,
    project: issue.projectId === mobile.id ? { id: mobile.id, name: mobile.name } : null,
    cycle:
      issue.cycleId === cycle14.id
        ? { id: cycle14.id, number: 14, startsOn: cycle14.startsOn, endsOn: cycle14.endsOn }
        : null,
    parent: parent ? { id: parent.id, key: parent.key, title: parent.title, status: parent.status } : null,
    children: s.issues.filter((i) => i.parentId === issue.id),
    comments: s.comments.filter((c) => c.issueId === issue.id),
    activity: s.activity.filter((a) => a.issueId === issue.id),
  };
}

function applyMockPatch(issue: IssueListItem, patch: IssueUpdateInput) {
  const { assigneeId, labelIds, description, ...rest } = patch;
  Object.assign(issue, rest);
  if (assigneeId !== undefined) issue.assignee = users.find((u) => u.id === assigneeId) ?? null;
  if (labelIds !== undefined) issue.labels = allLabels.filter((l) => labelIds.includes(l.id));
  if (description !== undefined) mock.state.descriptions[issue.id] = description;
}

export const handlers = [
  http.get('*/api/users', () => HttpResponse.json(users)),
  http.get('*/api/teams', () => HttpResponse.json([dev, des])),
  http.get('*/api/labels', ({ request }) => {
    const teamId = new URL(request.url).searchParams.get('teamId');
    return HttpResponse.json(allLabels.filter((l) => !teamId || l.teamId === teamId));
  }),
  http.get('*/api/projects', ({ request }) => {
    const teamId = new URL(request.url).searchParams.get('teamId');
    return HttpResponse.json(mock.state.projects.filter((p) => !teamId || p.teamId === teamId));
  }),
  http.get('*/api/projects/:id', ({ params }) => {
    const project = mock.state.projects.find((p) => p.id === params.id);
    return project ? HttpResponse.json(project) : notFound('Project');
  }),
  http.post('*/api/projects', async ({ request }) => {
    const body = (await request.json()) as { teamId: string; name: string };
    record(request, body);
    const project: Project = {
      id: `p-${mock.state.projects.length + 1}`,
      teamId: body.teamId,
      name: body.name,
      createdAt: STAMP,
      issueCount: 0,
      doneCount: 0,
    };
    mock.state.projects.push(project);
    return HttpResponse.json(project, { status: 201 });
  }),
  http.get('*/api/cycles', () => HttpResponse.json([cycle14])),
  http.get('*/api/cycles/:id', ({ params }) => (params.id === cycle14.id ? HttpResponse.json(cycle14) : notFound('Cycle'))),
  http.get('*/api/issues', ({ request }) => {
    record(request);
    const sp = new URL(request.url).searchParams;
    let list = [...mock.state.issues];
    const teamId = sp.get('teamId');
    if (teamId) list = list.filter((i) => i.teamId === teamId);
    const status = sp.getAll('status');
    if (status.length) list = list.filter((i) => status.includes(i.status));
    const priority = sp.getAll('priority');
    if (priority.length) list = list.filter((i) => priority.includes(i.priority));
    const assignees = sp.getAll('assigneeId');
    if (assignees.length) list = list.filter((i) => i.assignee !== null && assignees.includes(i.assignee.id));
    const labelIds = sp.getAll('labelId');
    if (labelIds.length) list = list.filter((i) => i.labels.some((l) => labelIds.includes(l.id)));
    const projectId = sp.get('projectId');
    if (projectId) list = list.filter((i) => i.projectId === projectId);
    const cycleId = sp.get('cycleId');
    if (cycleId) list = list.filter((i) => i.cycleId === cycleId);
    if (sp.get('mine') === 'true') {
      const userId = request.headers.get('x-user-id');
      list = list.filter((i) => i.assignee?.id === userId);
    }
    return HttpResponse.json(list.sort((a, b) => a.sortOrder - b.sortOrder));
  }),
  http.get('*/api/issues/:key', ({ params }) => {
    const issue = mock.state.issues.find((i) => i.key === String(params.key).toUpperCase());
    return issue ? HttpResponse.json(toDetail(issue)) : notFound('Issue');
  }),
  http.post('*/api/issues', async ({ request }) => {
    const body = (await request.json()) as IssueCreateInput;
    record(request, body);
    const created = makeIssue(
      mock.state.nextNumber++,
      body.title,
      body.status ?? 'todo',
      body.priority ?? 'none',
      users.find((u) => u.id === body.assigneeId) ?? null,
      allLabels.filter((l) => body.labelIds?.includes(l.id)),
      {
        teamId: body.teamId,
        projectId: body.projectId ?? null,
        cycleId: body.cycleId ?? null,
        parentId: body.parentId ?? null,
      },
    );
    mock.state.issues.push(created);
    return HttpResponse.json(toDetail(created), { status: 201 });
  }),
  http.patch('*/api/issues/:id', async ({ request, params }) => {
    const patch = (await request.json()) as IssueUpdateInput;
    record(request, patch);
    const issue = mock.state.issues.find((i) => i.id === params.id);
    if (!issue) return notFound('Issue');
    applyMockPatch(issue, patch);
    return HttpResponse.json(toDetail(issue));
  }),
  http.delete('*/api/issues/:id', ({ request, params }) => {
    record(request);
    mock.state.issues = mock.state.issues.filter((i) => i.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/issues/:id/comments', async ({ request, params }) => {
    const { body } = (await request.json()) as { body: string };
    record(request, { body });
    const author = users.find((u) => u.id === request.headers.get('x-user-id')) ?? anna;
    const comment: CommentDto = {
      id: `c-${mock.state.comments.length + 1}`,
      issueId: String(params.id),
      author,
      body,
      createdAt: new Date().toISOString(),
    };
    mock.state.comments.push(comment);
    return HttpResponse.json(comment, { status: 201 });
  }),
  http.get('*/api/inbox', ({ request }) => {
    const items = (mock.state.inbox[request.headers.get('x-user-id') ?? ''] ?? []).map((item) => ({
      ...item,
      read: mock.state.reads.has(item.activity.id),
    }));
    return HttpResponse.json({ items, unreadCount: items.filter((i) => !i.read).length });
  }),
  http.post('*/api/inbox/read', async ({ request }) => {
    const body = (await request.json()) as InboxReadInput;
    record(request, body);
    const items = mock.state.inbox[request.headers.get('x-user-id') ?? ''] ?? [];
    const ids = 'all' in body ? items.map((i) => i.activity.id) : body.activityIds;
    ids.forEach((id) => mock.state.reads.add(id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/views', () => HttpResponse.json(mock.state.views)),
  http.get('*/api/views/:id', ({ params }) => {
    const view = mock.state.views.find((v) => v.id === params.id);
    return view ? HttpResponse.json(view) : notFound('View');
  }),
  http.post('*/api/views', async ({ request }) => {
    const body = (await request.json()) as ViewCreateInput;
    record(request, body);
    const view: View = {
      id: `v-${mock.state.views.length + 1}`,
      name: body.name,
      filters: (body.filters ?? {}) as ViewFilters,
      createdAt: STAMP,
    };
    mock.state.views.push(view);
    return HttpResponse.json(view, { status: 201 });
  }),
  http.patch('*/api/views/:id', async ({ request, params }) => {
    const body = (await request.json()) as ViewUpdateInput;
    record(request, body);
    const view = mock.state.views.find((v) => v.id === params.id);
    if (!view) return notFound('View');
    if (body.name !== undefined) view.name = body.name;
    if (body.filters !== undefined) view.filters = body.filters as ViewFilters;
    return HttpResponse.json(view);
  }),
  http.delete('*/api/views/:id', ({ request, params }) => {
    record(request);
    mock.state.views = mock.state.views.filter((v) => v.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

export const server = setupServer(...handlers);
