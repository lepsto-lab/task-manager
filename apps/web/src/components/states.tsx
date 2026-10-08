import type { ReactNode } from 'react';
import styles from './states.module.css';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <div className={styles.title}>{title}</div>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      description={error.message}
      action={
        onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Retry
          </button>
        )
      }
    />
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <span className={styles.bar} style={{ width: `${30 + ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}
