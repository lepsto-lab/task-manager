import { Link } from 'react-router';
import { useViews } from '../api/queries';
import { ViewsIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import { countFilters, stripTeam } from '../lib/filters';
import styles from './lists.module.css';
import page from './page.module.css';

export function ViewsPage() {
  const views = useViews();
  return (
    <>
      <PageHeader crumbs={[{ label: 'Views' }]} />
      <div className={page.scroll}>
        {views.isPending ? (
          <ListSkeleton />
        ) : views.isError ? (
          <ErrorState error={views.error} onRetry={() => void views.refetch()} />
        ) : views.data.length === 0 ? (
          <EmptyState title="No views yet" description="Use Filter → Save as view on any issue list to keep a filter here." />
        ) : (
          <ul className={styles.list}>
            {views.data.map((view) => {
              const n = countFilters(stripTeam(view.filters));
              return (
                <li key={view.id}>
                  <Link to={`/views/${view.id}`} className={styles.row}>
                    <span className={styles.name}>
                      <ViewsIcon className="muted" />
                      {view.name}
                    </span>
                    <span className="muted">
                      {n} {n === 1 ? 'filter' : 'filters'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
