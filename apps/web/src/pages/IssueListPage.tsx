import { useParams, useSearchParams } from 'react-router';
import { useIssues, useTeamByKey } from '../api/queries';
import { IssueQueryList } from '../components/IssueList';
import { ListSkeleton } from '../components/states';
import { TeamIssuesHeader } from '../components/TeamIssuesHeader';
import { filtersFromSearch } from '../lib/filters';
import { useNewIssue } from '../lib/newIssue';
import { tabFromSearch } from '../lib/tabs';
import { useDensity } from '../lib/useDensity';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function IssueListPage() {
  const { teamKey = '' } = useParams();
  const { team, isLoading } = useTeamByKey(teamKey);
  const [sp] = useSearchParams();
  const [density, setDensity] = useDensity();
  const newIssue = useNewIssue();
  const issues = useIssues({ teamId: team?.id, ...filtersFromSearch(sp) }, { enabled: !!team });

  if (isLoading) return <ListSkeleton />;
  if (!team) return <NotFound title="Team not found" />;

  return (
    <>
      <TeamIssuesHeader team={team} view="list" density={density} onDensityChange={setDensity} />
      <div className={page.scroll}>
        <IssueQueryList
          query={issues}
          statuses={tabFromSearch(sp).list}
          density={density}
          onCreate={() => newIssue.open({ teamId: team.id })}
        />
      </div>
    </>
  );
}
