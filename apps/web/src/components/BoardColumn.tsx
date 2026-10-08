import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STATUS_LABELS, type IssueListItem, type IssueStatus } from '@tm/shared';
import { columnId } from '../lib/boardMove';
import { cx } from '../lib/cx';
import styles from './BoardColumn.module.css';
import { IssueCard } from './IssueCard';
import { PlusIcon, StatusIcon } from './icons';

function SortableCard({ issue }: { issue: IssueListItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <IssueCard issue={issue} />
    </div>
  );
}

export function BoardColumn({ status, issues, onAdd }: { status: IssueStatus; issues: IssueListItem[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const label = STATUS_LABELS[status];
  return (
    <section aria-label={label} className={cx(styles.column, isOver && styles.over)}>
      <div className={styles.header}>
        <span aria-hidden="true">
          <StatusIcon status={status} />
        </span>
        <span className={styles.name}>{label}</span>
        <span className="muted" aria-label={`${issues.length} issues`}>
          {issues.length}
        </span>
        <span className={styles.spacer} />
        <button type="button" className="icon-btn" aria-label={`Add issue to ${label}`} onClick={onAdd}>
          <PlusIcon />
        </button>
      </div>
      <SortableContext id={columnId(status)} items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.cards}>
          {issues.map((issue) => (
            <SortableCard key={issue.id} issue={issue} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
