import { useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useDeleteView, useUpdateView } from '../api/mutations';
import { useIssues, useView } from '../api/queries';
import { DisplayMenu } from '../components/DisplayMenu';
import { FilterMenu } from '../components/FilterMenu';
import { TrashIcon } from '../components/icons';
import { IssueQueryList } from '../components/IssueList';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, ListSkeleton } from '../components/states';
import { stripTeam } from '../lib/filters';
import { useDraft } from '../lib/useDraft';
import { useDensity } from '../lib/useDensity';
import styles from './lists.module.css';
import { NotFound } from './NotFound';
import page from './page.module.css';

function NameEditor({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const { draft, dirty, edit, reset, clean } = useDraft(value);
  const commit = () => {
    if (!dirty) return;
    const name = draft.trim();
    if (!name) {
      reset();
      return;
    }
    if (name !== value) onSave(name);
    clean();
  };
  return (
    <input
      className={styles.nameInput}
      aria-label="View name"
      value={draft}
      size={Math.max(8, draft.length)}
      onChange={(e) => edit(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') reset();
      }}
    />
  );
}

export function ViewPage() {
  const { id = '' } = useParams();
  const view = useView(id);
  const issues = useIssues(view.data?.filters ?? {}, { enabled: !!view.data });
  const update = useUpdateView(id);
  const remove = useDeleteView();
  const navigate = useNavigate();
  const [density, setDensity] = useDensity();

  if (view.isPending) return <ListSkeleton />;
  if (view.isError) {
    return view.error instanceof ApiError && view.error.status === 404 ? (
      <NotFound title="View not found" />
    ) : (
      <ErrorState error={view.error} />
    );
  }

  const { name, filters } = view.data;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Views', to: '/views' },
          { label: <NameEditor key={id} value={name} onSave={(next) => update.mutate({ name: next })} /> },
        ]}
      >
        <div className={page.spacer} />
        <div className={page.actions}>
          <FilterMenu
            teamId={filters.teamId}
            value={stripTeam(filters)}
            onChange={(next) => update.mutate({ filters: { ...next, teamId: filters.teamId } })}
          />
          <DisplayMenu value={density} onChange={setDensity} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm(`Delete view “${name}”?`)) remove.mutate(id, { onSuccess: () => navigate('/views') });
            }}
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </PageHeader>
      <div className={page.scroll}>
        <IssueQueryList query={issues} density={density} emptyTitle="No issues match this view" />
      </div>
    </>
  );
}
