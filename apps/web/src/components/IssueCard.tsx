import type { IssueListItem, IssueUpdateInput } from '@tm/shared';
import { Link } from 'react-router';
import { useUpdateIssue } from '../api/mutations';
import { cx } from '../lib/cx';
import styles from './IssueCard.module.css';
import { AssigneePicker, PriorityPicker } from './pickers';
import { LabelChip } from './primitives';

export function IssueCard({ issue, overlay = false }: { issue: IssueListItem; overlay?: boolean }) {
  const update = useUpdateIssue();
  const save = (patch: IssueUpdateInput) => update.mutate({ id: issue.id, patch });
  return (
    <article className={cx(styles.card, overlay && styles.overlay)}>
      <div className={styles.top}>
        <span className={cx('mono muted', styles.key)}>{issue.key}</span>
        <AssigneePicker
          size={20}
          value={issue.assignee?.id ?? null}
          fallback={issue.assignee}
          onChange={(assigneeId) => save({ assigneeId })}
        />
      </div>
      <Link to={`/issue/${issue.key}`} className={styles.title}>
        {issue.title}
      </Link>
      <div className={styles.meta}>
        <PriorityPicker variant="boxed" value={issue.priority} onChange={(priority) => save({ priority })} />
        {issue.labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </div>
    </article>
  );
}
