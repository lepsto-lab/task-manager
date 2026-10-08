import { Link, useParams } from 'react-router';
import { useCycles, useTeamByKey } from '../api/queries';
import { PageHeader } from '../components/PageHeader';
import { Progress, TeamCrumb } from '../components/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import { formatRange } from '../lib/format';
import styles from './lists.module.css';
import { NotFound } from './NotFound';
import page from './page.module.css';

const today = () => new Date().toISOString().slice(0, 10);

export function CyclesPage() {
  const { teamKey = '' } = useParams();
  const { team, isLoading } = useTeamByKey(teamKey);
  const cycles = useCycles(team?.id);

  if (isLoading) return <ListSkeleton />;
  if (!team) return <NotFound title="Team not found" />;

  const now = today();
  return (
    <>
      <PageHeader crumbs={[{ label: <TeamCrumb team={team} />, to: `/team/${team.key}/issues` }, { label: 'Cycles' }]} />
      <div className={page.scroll}>
        {cycles.isPending ? (
          <ListSkeleton />
        ) : cycles.isError ? (
          <ErrorState error={cycles.error} onRetry={() => void cycles.refetch()} />
        ) : cycles.data.length === 0 ? (
          <EmptyState title="No cycles yet" />
        ) : (
          <ul className={styles.list}>
            {[...cycles.data]
              .sort((a, b) => b.number - a.number)
              .map((cycle) => (
                <li key={cycle.id}>
                  <Link to={`/cycles/${cycle.id}`} className={styles.row}>
                    <span className={styles.name}>Cycle {cycle.number}</span>
                    <span className="muted">{formatRange(cycle.startsOn, cycle.endsOn)}</span>
                    {cycle.startsOn <= now && now <= cycle.endsOn && <span className={styles.badge}>Current</span>}
                    <span className={page.spacer} />
                    <Progress done={cycle.doneCount} total={cycle.issueCount} />
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}
