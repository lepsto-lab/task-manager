import type { InboxItem } from '@tm/shared';
import { useNavigate } from 'react-router';
import { useMarkRead } from '../api/mutations';
import { useInbox } from '../api/queries';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import { describeActivity } from '../lib/activityText';
import { useCurrentUser } from '../lib/currentUser';
import { cx } from '../lib/cx';
import { formatShortDate } from '../lib/format';
import styles from './InboxPage.module.css';
import page from './page.module.css';

export function InboxPage() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const inbox = useInbox(userId);
  const markRead = useMarkRead(userId);
  const navigate = useNavigate();

  const open = (item: InboxItem) => {
    if (!item.read) markRead.mutate({ activityIds: [item.activity.id] });
    navigate(`/issue/${item.issue.key}`);
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Inbox' }]}>
        <div className={page.spacer} />
        <button
          type="button"
          className="btn"
          disabled={!inbox.data?.unreadCount}
          onClick={() => markRead.mutate({ all: true })}
        >
          Mark all as read
        </button>
      </PageHeader>
      <div className={page.scroll}>
        {inbox.isPending ? (
          <ListSkeleton />
        ) : inbox.isError ? (
          <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
        ) : inbox.data.items.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="Updates on issues you created or are assigned to will show up here."
          />
        ) : (
          <ul className={styles.list}>
            {inbox.data.items.map((item) => (
              <li key={item.activity.id}>
                <button type="button" className={cx(styles.item, item.read && styles.read)} onClick={() => open(item)}>
                  {!item.read && <span className={styles.dot} role="img" aria-label="Unread" />}
                  <Avatar user={item.activity.actor} size={22} />
                  <span className={styles.text}>
                    <span className={styles.issueLine}>
                      <span className="mono muted">{item.issue.key}</span>
                      {item.issue.title}
                    </span>
                    <span className={styles.what}>
                      {item.activity.actor.name} {describeActivity(item.activity)}
                    </span>
                  </span>
                  <span className="muted">{formatShortDate(item.activity.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
