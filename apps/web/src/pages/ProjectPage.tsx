import { useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useIssues, useProject } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader } from '../components/PageHeader';
import { Progress } from '../components/primitives';
import { ErrorState, ListSkeleton } from '../components/states';
import { useDensity } from '../lib/useDensity';
import { NotFound } from './NotFound';
import page from './page.module.css';

export function ProjectPage() {
  const { id = '' } = useParams();
  const project = useProject(id);
  const issues = useIssues({ projectId: id });
  const [density, setDensity] = useDensity();

  if (project.isPending) return <ListSkeleton />;
  if (project.isError) {
    return project.error instanceof ApiError && project.error.status === 404 ? (
      <NotFound title="Project not found" />
    ) : (
      <ErrorState error={project.error} />
    );
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.data.name }]}>
        <div className={page.spacer} />
        <div className={page.actions}>
          <Progress done={project.data.doneCount} total={project.data.issueCount} />
          <DisplayMenu value={density} onChange={setDensity} />
        </div>
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues in this project" />
      </div>
    </>
  );
}
