import type { ActivityEntry, CommentDto, IssueDetail, IssueStatus, IssueUpdateInput } from '@tm/shared';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useAddComment, useDeleteIssue, useUpdateIssue } from '../api/mutations';
import { useIssue, useTeams } from '../api/queries';
import { PlusIcon, StatusIcon, TrashIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import {
  AssigneePicker,
  CyclePicker,
  DueDateField,
  EstimatePicker,
  LabelsPicker,
  PriorityPicker,
  ProjectPicker,
  StatusPicker,
} from '../components/pickers';
import { Avatar, TeamCrumb } from '../components/primitives';
import { ErrorState, ListSkeleton } from '../components/states';
import { describeActivity } from '../lib/activityText';
import { cx } from '../lib/cx';
import { formatShortDate } from '../lib/format';
import { useNewIssue } from '../lib/newIssue';
import { useDraft } from '../lib/useDraft';
import styles from './IssuePage.module.css';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function IssuePage() {
  const { issueKey = '' } = useParams();
  const query = useIssue(issueKey);
  if (query.isPending) return <ListSkeleton />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <NotFound title="Issue not found" />
    ) : (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  return <IssueDetailView issue={query.data} />;
}

function IssueDetailView({ issue }: { issue: IssueDetail }) {
  const update = useUpdateIssue();
  const remove = useDeleteIssue();
  const navigate = useNavigate();
  const newIssue = useNewIssue();
  const { data: teams = [] } = useTeams();
  const team = teams.find((t) => t.id === issue.teamId);
  const save = (patch: IssueUpdateInput) => update.mutate({ id: issue.id, patch });

  const onDelete = () => {
    if (remove.isPending || !window.confirm(`Delete ${issue.key}? This cannot be undone.`)) return;
    remove.mutate(issue.id, { onSuccess: () => navigate(team ? `/team/${team.key}/issues` : '/') });
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { label: team ? <TeamCrumb team={team} /> : '…', to: team ? `/team/${team.key}/issues` : undefined },
          { label: <span className="mono">{issue.key}</span> },
        ]}
      >
        <div className={page.spacer} />
        <button type="button" className="btn" onClick={onDelete}>
          <TrashIcon />
          Delete
        </button>
      </PageHeader>
      <div className={styles.body}>
        <article className={styles.article}>
          <div className={styles.content}>
            <TitleEditor key={`title-${issue.id}`} value={issue.title} onSave={(title) => save({ title })} />
            <DescriptionEditor key={`description-${issue.id}`} value={issue.description} onSave={(description) => save({ description })} />
            {issue.parent && (
              <Link className={styles.parentLink} to={`/issue/${issue.parent.key}`}>
                Sub-issue of <StatusIcon status={issue.parent.status} />
                <span className="mono">{issue.parent.key}</span>
                {issue.parent.title}
              </Link>
            )}
            <SubIssues
              issue={issue}
              onAdd={() =>
                newIssue.open({
                  teamId: issue.teamId,
                  parentId: issue.id,
                  projectId: issue.projectId,
                  cycleId: issue.cycleId,
                })
              }
            />
            <ActivityFeed issue={issue} />
          </div>
        </article>
        <PropertiesPanel issue={issue} onChange={save} />
      </div>
    </>
  );
}

function TitleEditor({ value, onSave }: { value: string; onSave: (title: string) => void }) {
  const { draft, dirty, edit, reset, clean } = useDraft(value);
  const commit = () => {
    if (!dirty) return;
    const title = draft.trim();
    if (!title) {
      reset();
      return;
    }
    if (title !== value) onSave(title);
    clean();
  };
  return (
    <input
      className={styles.title}
      aria-label="Issue title"
      value={draft}
      onChange={(e) => edit(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') reset();
      }}
    />
  );
}

function DescriptionEditor({ value, onSave }: { value: string; onSave: (description: string) => void }) {
  const { draft, dirty, edit, clean } = useDraft(value);
  return (
    <textarea
      className={styles.description}
      aria-label="Description"
      placeholder="Add description…"
      rows={Math.max(3, draft.split('\n').length + 1)}
      value={draft}
      onChange={(e) => edit(e.target.value)}
      onBlur={() => {
        if (!dirty) return;
        if (draft !== value) onSave(draft);
        clean();
      }}
    />
  );
}

function SubIssues({ issue, onAdd }: { issue: IssueDetail; onAdd: () => void }) {
  const done = issue.children.filter((c) => c.status === 'done').length;
  return (
    <section className={styles.subissues} aria-label="Sub-issues">
      <div className={styles.subHeader}>
        <span className={styles.subTitle}>Sub-issues</span>
        {issue.children.length > 0 && (
          <span className="muted">
            {done}/{issue.children.length}
          </span>
        )}
        <span className={styles.spacer} />
        <button type="button" className="icon-btn" aria-label="Add sub-issue" onClick={onAdd}>
          <PlusIcon />
        </button>
      </div>
      {issue.children.map((child) => (
        <Link key={child.id} to={`/issue/${child.key}`} className={styles.subRow}>
          <StatusIcon status={child.status} />
          <span className={cx('mono muted', styles.subKey)}>{child.key}</span>
          <span className={cx(styles.subName, child.status === 'done' && styles.subDone)}>{child.title}</span>
          <Avatar user={child.assignee} size={18} />
        </Link>
      ))}
    </section>
  );
}

type Entry = { kind: 'event'; at: string; event: ActivityEntry } | { kind: 'comment'; at: string; comment: CommentDto };

function ActivityFeed({ issue }: { issue: IssueDetail }) {
  const entries: Entry[] = [
    ...issue.activity
      .filter((a) => a.type !== 'comment')
      .map((event): Entry => ({ kind: 'event', at: event.createdAt, event })),
    ...issue.comments.map((comment): Entry => ({ kind: 'comment', at: comment.createdAt, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section className={styles.activity} aria-label="Activity">
      <h2 className={styles.activityTitle}>Activity</h2>
      {entries.map((entry) =>
        entry.kind === 'event' ? (
          <div key={entry.event.id} className={styles.event}>
            {entry.event.type === 'status' ? (
              <span className={styles.eventIcon}>
                <StatusIcon status={(entry.event.payload as { to: IssueStatus }).to} />
              </span>
            ) : (
              <Avatar user={entry.event.actor} size={20} />
            )}
            <span>
              <span className={styles.actor}>{entry.event.actor.name}</span> {describeActivity(entry.event)} ·{' '}
              {formatShortDate(entry.event.createdAt)}
            </span>
          </div>
        ) : (
          <div key={entry.comment.id} className={styles.comment}>
            <div className={styles.commentHead}>
              <Avatar user={entry.comment.author} size={20} />
              <span className={styles.commentAuthor}>{entry.comment.author.name}</span>
              <span className="muted">{formatShortDate(entry.comment.createdAt)}</span>
            </div>
            <div className={styles.commentBody}>{entry.comment.body}</div>
          </div>
        ),
      )}
      <CommentBox issueId={issue.id} />
    </section>
  );
}

function CommentBox({ issueId }: { issueId: string }) {
  const [body, setBody] = useState('');
  const add = useAddComment();
  const submit = () => {
    const text = body.trim();
    if (!text || add.isPending) return;
    add.mutate({ issueId, body: text }, { onSuccess: () => setBody('') });
  };
  return (
    <form
      className={styles.commentBox}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label="Comment"
        rows={3}
        placeholder="Leave a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className={styles.commentActions}>
        <button type="submit" className="btn btn-primary" disabled={!body.trim() || add.isPending}>
          Comment
        </button>
      </div>
    </form>
  );
}

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.propRow}>
      <span className={styles.propLabel}>{label}</span>
      <div className={styles.propValue}>{children}</div>
    </div>
  );
}

function PropertiesPanel({ issue, onChange }: { issue: IssueDetail; onChange: (patch: IssueUpdateInput) => void }) {
  return (
    <aside className={styles.props} aria-label="Issue properties">
      <div className={styles.propsTitle}>Properties</div>
      <PropRow label="Status">
        <StatusPicker variant="full" value={issue.status} onChange={(status) => onChange({ status })} />
      </PropRow>
      <PropRow label="Priority">
        <PriorityPicker variant="full" value={issue.priority} onChange={(priority) => onChange({ priority })} />
      </PropRow>
      <PropRow label="Assignee">
        <AssigneePicker
          variant="full"
          value={issue.assignee?.id ?? null}
          fallback={issue.assignee}
          onChange={(assigneeId) => onChange({ assigneeId })}
        />
      </PropRow>
      <PropRow label="Labels">
        <LabelsPicker teamId={issue.teamId} value={issue.labels.map((l) => l.id)} onChange={(labelIds) => onChange({ labelIds })} />
      </PropRow>
      <PropRow label="Project">
        <ProjectPicker teamId={issue.teamId} value={issue.projectId} onChange={(projectId) => onChange({ projectId })} />
      </PropRow>
      <PropRow label="Cycle">
        <CyclePicker teamId={issue.teamId} value={issue.cycleId} onChange={(cycleId) => onChange({ cycleId })} />
      </PropRow>
      <PropRow label="Due date">
        <DueDateField value={issue.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
      </PropRow>
      <PropRow label="Estimate">
        <EstimatePicker value={issue.estimate} onChange={(estimate) => onChange({ estimate })} />
      </PropRow>
    </aside>
  );
}
