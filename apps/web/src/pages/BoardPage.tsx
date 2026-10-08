import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useUpdateIssue } from '../api/mutations';
import { useIssues, useTeamByKey } from '../api/queries';
import { BoardColumn } from '../components/BoardColumn';
import { IssueCard } from '../components/IssueCard';
import { ErrorState, ListSkeleton } from '../components/states';
import { TeamIssuesHeader } from '../components/TeamIssuesHeader';
import { groupByStatus, planMove } from '../lib/boardMove';
import { filtersFromSearch } from '../lib/filters';
import { useNewIssue } from '../lib/newIssue';
import { tabFromSearch } from '../lib/tabs';
import styles from './BoardPage.module.css';
import { NotFound } from './NotFound';

export function BoardPage() {
  const { teamKey = '' } = useParams();
  const { team, isLoading } = useTeamByKey(teamKey);
  const [sp] = useSearchParams();
  const issues = useIssues({ teamId: team?.id, ...filtersFromSearch(sp) }, { enabled: !!team });
  const update = useUpdateIssue();
  const newIssue = useNewIssue();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const columns = useMemo(() => groupByStatus(issues.data ?? []), [issues.data]);

  if (isLoading) return <ListSkeleton />;
  if (!team) return <NotFound title="Team not found" />;

  const dragged = draggedId ? issues.data?.find((i) => i.id === draggedId) : undefined;
  const onDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    if (!event.over) return;
    const move = planMove(columns, String(event.active.id), String(event.over.id));
    if (move) update.mutate({ id: String(event.active.id), patch: move });
  };

  return (
    <>
      <TeamIssuesHeader team={team} view="board" />
      {issues.isPending ? (
        <ListSkeleton />
      ) : issues.isError ? (
        <ErrorState error={issues.error} onRetry={() => void issues.refetch()} />
      ) : (
        <div className={styles.board}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(event) => setDraggedId(String(event.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDraggedId(null)}
          >
            {tabFromSearch(sp).board.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                issues={columns[status]}
                onAdd={() => newIssue.open({ teamId: team.id, status })}
              />
            ))}
            <DragOverlay>{dragged ? <IssueCard issue={dragged} overlay /> : null}</DragOverlay>
          </DndContext>
        </div>
      )}
    </>
  );
}
