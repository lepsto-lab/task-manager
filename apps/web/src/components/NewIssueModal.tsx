import type { IssuePriority, IssueStatus } from '@tm/shared';
import { useState } from 'react';
import { useCreateIssue } from '../api/mutations';
import { useTeams } from '../api/queries';
import type { NewIssueDefaults } from '../lib/newIssue';
import { useToast } from '../lib/toast';
import { CloseIcon } from './icons';
import styles from './NewIssueModal.module.css';
import { AssigneePicker, CyclePicker, LabelsPicker, PriorityPicker, ProjectPicker, StatusPicker } from './pickers';

interface Draft {
  teamId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  labelIds: string[];
  projectId: string | null;
  cycleId: string | null;
  parentId: string | null;
}

export function NewIssueModal({ defaults, onClose }: { defaults: NewIssueDefaults; onClose: () => void }) {
  const { data: teams = [] } = useTeams();
  const create = useCreateIssue();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    teamId: defaults.teamId ?? '',
    title: '',
    description: '',
    status: defaults.status ?? 'todo',
    priority: 'none',
    assigneeId: null,
    labelIds: [],
    projectId: defaults.projectId ?? null,
    cycleId: defaults.cycleId ?? null,
    parentId: defaults.parentId ?? null,
  });
  const teamId = draft.teamId || teams[0]?.id || '';
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const canSubmit = draft.title.trim().length > 0 && teamId !== '' && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const { description, ...rest } = draft;
    create.mutate(
      { ...rest, teamId, title: draft.title.trim(), description: description.trim() ? description : undefined },
      {
        onSuccess: (issue) => {
          toast.show(`Created ${issue.key}`);
          onClose();
        },
      },
    );
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-issue-title"
        className={styles.modal}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <div className={styles.head}>
          <select
            className={styles.teamSelect}
            aria-label="Team"
            value={teamId}
            disabled={!!draft.parentId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, teamId: e.target.value, labelIds: [], projectId: null, cycleId: null }))
            }
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.key}
              </option>
            ))}
          </select>
          <span id="new-issue-title" className={styles.headTitle}>
            New issue
          </span>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <input
          autoFocus
          className={styles.title}
          placeholder="Issue title"
          aria-label="Issue title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
        />
        <textarea
          className={styles.description}
          placeholder="Add description…"
          aria-label="Description"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className={styles.props}>
          <StatusPicker variant="chip" value={draft.status} onChange={(v) => set('status', v)} />
          <PriorityPicker variant="chip" value={draft.priority} onChange={(v) => set('priority', v)} />
          <AssigneePicker variant="chip" value={draft.assigneeId} onChange={(v) => set('assigneeId', v)} />
          {teamId && (
            <>
              <LabelsPicker variant="chip" teamId={teamId} value={draft.labelIds} onChange={(v) => set('labelIds', v)} />
              <ProjectPicker variant="chip" teamId={teamId} value={draft.projectId} onChange={(v) => set('projectId', v)} />
              <CyclePicker variant="chip" teamId={teamId} value={draft.cycleId} onChange={(v) => set('cycleId', v)} />
            </>
          )}
        </div>
        <div className={styles.foot}>
          {create.isError && <span className={styles.error}>{create.error.message}</span>}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            Create issue
          </button>
        </div>
      </div>
    </div>
  );
}
