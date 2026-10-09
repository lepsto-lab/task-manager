import type { Team } from '@tm/shared';
import { useNavigate, useSearchParams } from 'react-router';
import { useCreateView } from '../api/mutations';
import { cx } from '../lib/cx';
import { applyFiltersToSearch, filtersFromSearch } from '../lib/filters';
import { ISSUE_TABS, tabFromSearch, type IssueTab } from '../lib/tabs';
import type { Density } from '../lib/useDensity';
import page from '../pages/page.module.css';
import { DisplayMenu } from './DisplayMenu';
import { FilterMenu } from './FilterMenu';
import { PageHeader } from './PageHeader';
import { TeamCrumb } from './primitives';
import { ViewToggle } from './ViewToggle';

export function TeamIssuesHeader({
  team,
  view,
  density,
  onDensityChange,
}: {
  team: Team;
  view: 'list' | 'board';
  density?: Density;
  onDensityChange?: (density: Density) => void;
}) {
  const [sp, setSp] = useSearchParams();
  const tab = tabFromSearch(sp);
  const filters = filtersFromSearch(sp);
  const createView = useCreateView();
  const navigate = useNavigate();

  const selectTab = (id: IssueTab['id']) => {
    const next = new URLSearchParams(sp);
    if (id === 'all') next.delete('tab');
    else next.set('tab', id);
    setSp(next);
  };

  return (
    <PageHeader crumbs={[{ label: <TeamCrumb team={team} /> }, { label: 'Issues' }]}>
      <div role="tablist" aria-label="Issue filter" className={page.tabs}>
        {ISSUE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab.id}
            className={cx(page.tab, t.id === tab.id && page.tabActive)}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={page.spacer} />
      <div className={page.actions}>
        <FilterMenu
          teamId={team.id}
          value={filters}
          onChange={(f) => setSp(applyFiltersToSearch(sp, f))}
          onSaveView={(name) =>
            createView.mutate(
              { name, filters: { ...filters, teamId: team.id } },
              { onSuccess: (created) => navigate(`/views/${created.id}`) },
            )
          }
        />
        <ViewToggle teamKey={team.key} active={view} search={sp} />
        {density && onDensityChange && <DisplayMenu value={density} onChange={onDensityChange} />}
      </div>
    </PageHeader>
  );
}
