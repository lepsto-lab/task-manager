import { useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useCycle, useIssues, useTeams } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader, type Crumb } from '../components/PageHeader';
import { Progress, TeamCrumb } from '../components/primitives';
import { ErrorState, ListSkeleton } from '../components/states';
import { formatRange } from '../lib/format';
import { useDensity } from '../lib/useDensity';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function CyclePage() {
  const { id = '' } = useParams();
  const cycle = useCycle(id);
  const issues = useIssues({ cycleId: id });
  const { data: teams = [] } = useTeams();
  const [density, setDensity] = useDensity();

  if (cycle.isPending) return <ListSkeleton />;
  if (cycle.isError) {
    return cycle.error instanceof ApiError && cycle.error.status === 404 ? (
      <NotFound title="Cycle not found" />
    ) : (
      <ErrorState error={cycle.error} />
    );
  }

  const team = teams.find((t) => t.id === cycle.data.teamId);
  const crumbs: Crumb[] = team
    ? [
        { label: <TeamCrumb team={team} />, to: `/team/${team.key}/issues` },
        { label: 'Cycles', to: `/team/${team.key}/cycles` },
        { label: `Cycle ${cycle.data.number}` },
      ]
    : [{ label: `Cycle ${cycle.data.number}` }];

  return (
    <>
      <PageHeader crumbs={crumbs}>
        <span className="muted">{formatRange(cycle.data.startsOn, cycle.data.endsOn)}</span>
        <div className={page.spacer} />
        <div className={page.actions}>
          <Progress done={cycle.data.doneCount} total={cycle.data.issueCount} />
          <DisplayMenu value={density} onChange={setDensity} />
        </div>
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues in this cycle" />
      </div>
    </>
  );
}
