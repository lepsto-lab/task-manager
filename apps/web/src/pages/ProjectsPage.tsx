import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCreateProject } from '../api/mutations';
import { useProjects, useTeams } from '../api/queries';
import { ProjectIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Progress, TeamCrumb } from '../components/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '../components/states';
import styles from './lists.module.css';
import page from './page.module.css';

export function ProjectsPage() {
  const [sp] = useSearchParams();
  const teamId = sp.get('teamId') ?? undefined;
  const { data: teams = [] } = useTeams();
  const projects = useProjects(teamId);
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const team = teams.find((t) => t.id === teamId);
  const targetTeamId = teamId ?? (newTeamId || teams[0]?.id || '');

  return (
    <>
      <PageHeader
        crumbs={
          team
            ? [{ label: <TeamCrumb team={team} />, to: `/team/${team.key}/issues` }, { label: 'Projects' }]
            : [{ label: 'Projects' }]
        }
      />
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !targetTeamId) return;
          create.mutate({ teamId: targetTeamId, name: name.trim() }, { onSuccess: () => setName('') });
        }}
      >
        {!teamId && (
          <select className="input" aria-label="Team" value={targetTeamId} onChange={(e) => setNewTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <input
          className="input"
          placeholder="New project name"
          aria-label="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create project
        </button>
      </form>
      <div className={page.scroll}>
        {projects.isPending ? (
          <ListSkeleton />
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.data.length === 0 ? (
          <EmptyState title="No projects yet" description="Create one above to group related issues." />
        ) : (
          <ul className={styles.list}>
            {projects.data.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className={styles.row}>
                  <span className={styles.name}>
                    <ProjectIcon className="muted" />
                    {project.name}
                  </span>
                  <span className="muted">{teams.find((t) => t.id === project.teamId)?.name}</span>
                  <span className={page.spacer} />
                  <Progress done={project.doneCount} total={project.issueCount} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
