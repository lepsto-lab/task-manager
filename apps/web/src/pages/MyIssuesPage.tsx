import { useIssues } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader } from '../components/PageHeader';
import { useCurrentUser } from '../lib/currentUser';
import { useDensity } from '../lib/useDensity';
import page from './page.module.css';

export function MyIssuesPage() {
  const { user } = useCurrentUser();
  const [density, setDensity] = useDensity();
  const issues = useIssues({ mine: true }, { scope: user?.id ?? '', enabled: !!user });
  return (
    <>
      <PageHeader crumbs={[{ label: 'My issues' }]}>
        <div className={page.spacer} />
        <DisplayMenu value={density} onChange={setDensity} />
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues assigned to you" />
      </div>
    </>
  );
}
