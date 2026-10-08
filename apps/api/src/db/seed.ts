import type { IssuePriority, IssueStatus } from '@tm/shared';
import type { DbOrTx } from './client';
import { activity, comments, cycles, issueLabels, issues, labels, projects, teams, users, views } from './schema';
import { truncateAll } from './truncate';

type Who = 'AR' | 'MK' | 'DS' | 'EV';

interface SeedIssue {
  team: 'DEV' | 'DES';
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  who: Who;
  date: string;
  parent?: number;
  description?: string;
  dueDate?: string;
  estimate?: number;
  project?: boolean;
}

const USERS: { initials: Who; name: string; color: string }[] = [
  { initials: 'AR', name: 'Anna Romanova', color: '#6D4FC2' },
  { initials: 'MK', name: 'Max Kim', color: '#2F7D6D' },
  { initials: 'DS', name: 'Denis Sokolov', color: '#B5582F' },
  { initials: 'EV', name: 'Elena Volkova', color: '#3F6FB5' },
];

const DEV_LABELS = [
  ['Bug', '#EB5757'],
  ['Feature', '#A78BFA'],
  ['Mobile', '#4EA7FC'],
  ['Infra', '#2FB5A5'],
  ['Design', '#F07CB4'],
  ['Docs', '#8E8E97'],
] as const;

const DES_LABELS = [
  ['Design', '#F07CB4'],
  ['Research', '#4EA7FC'],
] as const;

const OFFLINE_DESCRIPTION = [
  'Mobile users lose their changes when the connection drops mid-edit. Edits should be saved locally and sent once the connection is back.',
  '',
  'Acceptance criteria',
  '- Creating and editing issues works offline',
  '- The change queue is sent automatically on reconnect',
  '- Conflicts are shown to the user with a choice of version',
].join('\n');

const ISSUES: SeedIssue[] = [
  { team: 'DEV', number: 151, title: 'Crash when uploading attachments over 25 MB', status: 'in_progress', priority: 'urgent', labels: ['Bug'], who: 'AR', date: '2026-10-07' },
  { team: 'DEV', number: 142, title: 'Offline sync for issues', status: 'in_progress', priority: 'high', labels: ['Feature', 'Mobile'], who: 'AR', date: '2026-10-02', description: OFFLINE_DESCRIPTION, dueDate: '2026-10-17', estimate: 5, project: true },
  { team: 'DEV', number: 139, title: 'Keyboard shortcuts for changing status', status: 'in_progress', priority: 'medium', labels: ['Feature'], who: 'MK', date: '2026-09-30' },
  { team: 'DEV', number: 133, title: 'Move notifications to an event queue', status: 'in_review', priority: 'medium', labels: ['Infra'], who: 'DS', date: '2026-09-28' },
  { team: 'DEV', number: 128, title: 'Dark theme in profile settings', status: 'in_review', priority: 'low', labels: ['Design'], who: 'EV', date: '2026-09-25' },
  { team: 'DEV', number: 160, title: 'Wrong unread count in Inbox', status: 'todo', priority: 'high', labels: ['Bug'], who: 'MK', date: '2026-10-08' },
  { team: 'DEV', number: 156, title: 'Filter by multiple assignees', status: 'todo', priority: 'medium', labels: ['Feature'], who: 'EV', date: '2026-10-06' },
  { team: 'DEV', number: 157, title: 'Export cycle to CSV', status: 'todo', priority: 'low', labels: ['Feature'], who: 'DS', date: '2026-10-06' },
  { team: 'DEV', number: 161, title: 'Document the webhooks API', status: 'todo', priority: 'none', labels: ['Docs'], who: 'DS', date: '2026-10-08' },
  { team: 'DEV', number: 112, title: 'Issue templates for teams', status: 'backlog', priority: 'low', labels: ['Feature'], who: 'EV', date: '2026-09-12' },
  { team: 'DEV', number: 118, title: 'Two-way calendar sync', status: 'backlog', priority: 'none', labels: ['Feature'], who: 'MK', date: '2026-09-15' },
  { team: 'DEV', number: 120, title: 'Bulk edit selected issues', status: 'backlog', priority: 'medium', labels: ['Feature', 'Design'], who: 'AR', date: '2026-09-16' },
  { team: 'DEV', number: 131, title: 'Speed up issue search', status: 'done', priority: 'high', labels: ['Infra'], who: 'DS', date: '2026-09-27' },
  { team: 'DEV', number: 126, title: 'Avatars in the assignee picker', status: 'done', priority: 'low', labels: ['Design'], who: 'EV', date: '2026-09-22' },
  { team: 'DEV', number: 143, title: 'Local storage for drafts', status: 'done', priority: 'medium', labels: ['Mobile'], who: 'AR', date: '2026-10-02', parent: 142, project: true },
  { team: 'DEV', number: 144, title: 'Outgoing change queue', status: 'in_progress', priority: 'medium', labels: ['Mobile'], who: 'AR', date: '2026-10-02', parent: 142, project: true },
  { team: 'DEV', number: 145, title: 'Conflict resolution screen', status: 'todo', priority: 'medium', labels: ['Mobile', 'Design'], who: 'EV', date: '2026-10-02', parent: 142, project: true },
  { team: 'DES', number: 1, title: 'Refresh the icon set', status: 'todo', priority: 'medium', labels: ['Design'], who: 'EV', date: '2026-10-03' },
  { team: 'DES', number: 2, title: 'Onboarding illustrations', status: 'backlog', priority: 'low', labels: ['Research'], who: 'DS', date: '2026-10-04' },
];

const at = (date: string, time = '09:00') => new Date(`${date}T${time}:00Z`);

export async function seed(db: DbOrTx): Promise<void> {
  await db.transaction(async (tx) => {
    await truncateAll(tx);

    const userRows = await tx.insert(users).values(USERS).returning();
    const user = Object.fromEntries(userRows.map((u) => [u.initials, u])) as Record<Who, (typeof userRows)[number]>;

    const [dev] = await tx
      .insert(teams)
      .values({ name: 'Engineering', key: 'DEV', color: '#2F7D6D', issueCounter: 161, createdAt: at('2026-09-01') })
      .returning();
    const [des] = await tx
      .insert(teams)
      .values({ name: 'Design', key: 'DES', color: '#B5582F', issueCounter: 2, createdAt: at('2026-09-02') })
      .returning();
    const team = { DEV: dev, DES: des };

    const devLabels = await tx
      .insert(labels)
      .values(DEV_LABELS.map(([name, color]) => ({ teamId: dev.id, name, color })))
      .returning();
    const desLabels = await tx
      .insert(labels)
      .values(DES_LABELS.map(([name, color]) => ({ teamId: des.id, name, color })))
      .returning();
    const labelId = (teamKey: 'DEV' | 'DES', name: string) =>
      (teamKey === 'DEV' ? devLabels : desLabels).find((l) => l.name === name)!.id;

    const [mobile] = await tx.insert(projects).values({ teamId: dev.id, name: 'Mobile app 2.0', createdAt: at('2026-09-01') }).returning();
    const [cycle13, cycle14] = await tx
      .insert(cycles)
      .values([
        { teamId: dev.id, number: 13, startsOn: '2026-09-22', endsOn: '2026-10-05' },
        { teamId: dev.id, number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' },
      ])
      .returning();

    const positions = new Map<string, number>();
    const ids = new Map<string, string>();
    for (const item of ISSUES) {
      const bucket = `${item.team}:${item.status}`;
      const position = (positions.get(bucket) ?? 0) + 1;
      positions.set(bucket, position);
      const cycleId =
        item.team !== 'DEV' || item.status === 'backlog'
          ? null
          : item.status === 'done' && !item.parent
            ? cycle13.id
            : cycle14.id;
      const [row] = await tx
        .insert(issues)
        .values({
          teamId: team[item.team].id,
          number: item.number,
          title: item.title,
          description: item.description ?? '',
          status: item.status,
          priority: item.priority,
          assigneeId: user[item.who].id,
          creatorId: user[item.who].id,
          projectId: item.project ? mobile.id : null,
          cycleId,
          parentId: item.parent ? ids.get(`DEV-${item.parent}`)! : null,
          dueDate: item.dueDate ?? null,
          estimate: item.estimate ?? null,
          sortOrder: position * 1000,
          createdAt: at(item.date),
          updatedAt: at(item.date),
        })
        .returning({ id: issues.id });
      ids.set(`${item.team}-${item.number}`, row.id);
      await tx.insert(issueLabels).values(item.labels.map((name) => ({ issueId: row.id, labelId: labelId(item.team, name) })));
      await tx.insert(activity).values({ issueId: row.id, actorId: user[item.who].id, type: 'created', payload: {}, createdAt: at(item.date) });
    }

    const offline = ids.get('DEV-142')!;
    await tx.insert(activity).values({
      issueId: offline,
      actorId: user.AR.id,
      type: 'status',
      payload: { from: 'todo', to: 'in_progress' },
      createdAt: at('2026-10-05'),
    });
    const [comment] = await tx
      .insert(comments)
      .values({
        issueId: offline,
        authorId: user.MK.id,
        body: 'For the queue I suggest storing operations rather than issue snapshots — that makes conflicts much easier to resolve.',
        createdAt: at('2026-10-06', '10:00'),
      })
      .returning();
    await tx.insert(activity).values([
      { issueId: offline, actorId: user.MK.id, type: 'comment', payload: { commentId: comment.id }, createdAt: at('2026-10-06', '10:00') },
      { issueId: ids.get('DEV-151')!, actorId: user.MK.id, type: 'priority', payload: { from: 'high', to: 'urgent' }, createdAt: at('2026-10-07', '12:00') },
      { issueId: ids.get('DEV-120')!, actorId: user.EV.id, type: 'labels', payload: { added: ['Design'], removed: [] }, createdAt: at('2026-09-17') },
    ]);

    await tx.insert(views).values({
      name: 'Urgent & high bugs',
      filters: { teamId: dev.id, priority: ['urgent', 'high'], labelId: [labelId('DEV', 'Bug')] },
    });
  });
}
