import { LIST_STATUS_ORDER, STATUS_LABELS, type IssueListItem, type IssueStatus } from '@tm/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { Density } from '../lib/useDensity';
import { ChevronIcon, StatusIcon } from './icons';
import styles from './IssueList.module.css';
import { IssueRow } from './IssueRow';
import { EmptyState, ErrorState, ListSkeleton } from './states';

export interface IssueListProps {
  issues: IssueListItem[];
  statuses?: readonly IssueStatus[];
  density?: Density;
  emptyTitle?: string;
  onCreate?: () => void;
}

export function IssueList({
  issues,
  statuses = LIST_STATUS_ORDER,
  density = 'comfortable',
  emptyTitle = 'No issues',
  onCreate,
}: IssueListProps) {
  const [closed, setClosed] = useState<Set<IssueStatus>>(() => new Set(['done']));
  const groups = statuses
    .map((status) => ({ status, items: issues.filter((i) => i.status === status) }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        action={
          onCreate && (
            <button type="button" className="btn" onClick={onCreate}>
              New issue
            </button>
          )
        }
      />
    );
  }

  const toggle = (status: IssueStatus) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  return (
    <div>
      {groups.map(({ status, items }) => {
        const open = !closed.has(status);
        return (
          <section key={status} aria-label={STATUS_LABELS[status]}>
            <button type="button" className={styles.group} aria-expanded={open} onClick={() => toggle(status)}>
              <ChevronIcon className={open ? styles.chevronOpen : styles.chevron} />
              <span className={styles.groupIcon} aria-hidden="true">
                <StatusIcon status={status} />
              </span>
              <span className={styles.groupName}>{STATUS_LABELS[status]}</span>
              <span className="muted">{items.length}</span>
            </button>
            {open && (
              <ul className={styles.items}>
                {items.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} density={density} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function IssueQueryList({
  query,
  ...props
}: { query: UseQueryResult<IssueListItem[], Error> } & Omit<IssueListProps, 'issues'>) {
  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <IssueList issues={query.data} {...props} />;
}
