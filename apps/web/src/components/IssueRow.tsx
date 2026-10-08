import type { IssueListItem, IssueUpdateInput } from '@tm/shared';
import { Link } from 'react-router';
import { useUpdateIssue } from '../api/mutations';
import { cx } from '../lib/cx';
import { formatShortDate } from '../lib/format';
import type { Density } from '../lib/useDensity';
import styles from './IssueRow.module.css';
import { AssigneePicker, PriorityPicker, StatusPicker } from './pickers';
import { LabelChip } from './primitives';

export function IssueRow({ issue, density }: { issue: IssueListItem; density: Density }) {
  const update = useUpdateIssue();
  const save = (patch: IssueUpdateInput) => update.mutate({ id: issue.id, patch });
  return (
    <li className={cx(styles.row, density === 'compact' && styles.compact)}>
      <PriorityPicker value={issue.priority} onChange={(priority) => save({ priority })} />
      <span className={cx('mono muted', styles.key)}>{issue.key}</span>
      <StatusPicker value={issue.status} onChange={(status) => save({ status })} />
      <Link to={`/issue/${issue.key}`} className={styles.title}>
        {issue.title}
      </Link>
      <span className={styles.meta}>
        {issue.labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </span>
      <span className={cx(styles.meta, styles.date)}>{formatShortDate(issue.createdAt)}</span>
      <AssigneePicker
        value={issue.assignee?.id ?? null}
        fallback={issue.assignee}
        onChange={(assigneeId) => save({ assigneeId })}
      />
    </li>
  );
}
