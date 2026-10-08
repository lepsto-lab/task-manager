import {
  BOARD_STATUS_ORDER,
  ESTIMATE_OPTIONS,
  ISSUE_PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type IssuePriority,
  type IssueStatus,
  type User,
} from '@tm/shared';
import { useCycles, useLabels, useProjects, useUsers } from '../api/queries';
import { cycleName, formatEstimate } from '../lib/format';
import { PriorityIcon, ProjectIcon, StatusIcon } from './icons';
import { Avatar, LabelChip } from './primitives';
import styles from './pickers.module.css';
import { PropertyPicker } from './PropertyPicker';

export type PickerVariant = 'icon' | 'boxed' | 'full' | 'chip';

const withText = (variant: PickerVariant) => variant === 'full' || variant === 'chip';
const rootClass = (variant: PickerVariant) => (variant === 'full' ? styles.block : undefined);

export function StatusPicker({
  value,
  onChange,
  variant = 'icon',
}: {
  value: IssueStatus;
  onChange: (value: IssueStatus) => void;
  variant?: PickerVariant;
}) {
  return (
    <PropertyPicker
      label="Status"
      triggerLabel={`Status: ${STATUS_LABELS[value]}`}
      value={value}
      options={BOARD_STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s], icon: <StatusIcon status={s} /> }))}
      onChange={onChange}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <StatusIcon status={value} />
          {withText(variant) && <span>{STATUS_LABELS[value]}</span>}
        </>
      }
    />
  );
}

export function PriorityPicker({
  value,
  onChange,
  variant = 'icon',
}: {
  value: IssuePriority;
  onChange: (value: IssuePriority) => void;
  variant?: PickerVariant;
}) {
  return (
    <PropertyPicker
      label="Priority"
      triggerLabel={`Priority: ${PRIORITY_LABELS[value]}`}
      value={value}
      options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p], icon: <PriorityIcon priority={p} /> }))}
      onChange={onChange}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <PriorityIcon priority={value} size={variant === 'boxed' ? 12 : 14} />
          {withText(variant) && <span>{PRIORITY_LABELS[value]}</span>}
        </>
      }
    />
  );
}

export function AssigneePicker({
  value,
  fallback = null,
  onChange,
  variant = 'icon',
  size = 22,
}: {
  value: string | null;
  fallback?: User | null;
  onChange: (value: string | null) => void;
  variant?: PickerVariant;
  size?: number;
}) {
  const { data: users = [] } = useUsers();
  const current = users.find((u) => u.id === value) ?? (fallback && fallback.id === value ? fallback : null);
  return (
    <PropertyPicker
      label="Assignee"
      searchable
      triggerLabel={`Assignee: ${current?.name ?? 'No assignee'}`}
      value={value ?? ''}
      options={[
        { value: '', label: 'No assignee', icon: <Avatar user={null} size={18} /> },
        ...users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> })),
      ]}
      onChange={(v) => onChange(v || null)}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <Avatar user={current} size={withText(variant) ? 18 : size} />
          {withText(variant) && <span>{current?.name ?? 'Unassigned'}</span>}
        </>
      }
    />
  );
}

export function LabelsPicker({
  teamId,
  value,
  onChange,
  variant = 'full',
}: {
  teamId: string;
  value: string[];
  onChange: (value: string[]) => void;
  variant?: 'full' | 'chip';
}) {
  const { data: labels = [] } = useLabels(teamId);
  const selected = labels.filter((l) => value.includes(l.id));
  return (
    <PropertyPicker
      multiple
      searchable
      label="Labels"
      value={value}
      options={labels.map((l) => ({
        value: l.id,
        label: l.name,
        icon: <span className={styles.dot} style={{ background: l.color }} />,
      }))}
      onChange={onChange}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        selected.length > 0 ? (
          <span className={styles.chips}>
            {selected.map((l) => (
              <LabelChip key={l.id} label={l} />
            ))}
          </span>
        ) : (
          <span className="muted">Add label</span>
        )
      }
    />
  );
}

export function ProjectPicker({
  teamId,
  value,
  onChange,
  variant = 'full',
}: {
  teamId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: 'full' | 'chip';
}) {
  const { data: projects = [] } = useProjects(teamId);
  const current = projects.find((p) => p.id === value);
  return (
    <PropertyPicker
      label="Project"
      searchable
      triggerLabel={`Project: ${current?.name ?? 'No project'}`}
      value={value ?? ''}
      options={[
        { value: '', label: 'No project' },
        ...projects.map((p) => ({ value: p.id, label: p.name, icon: <ProjectIcon /> })),
      ]}
      onChange={(v) => onChange(v || null)}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={
        <>
          <ProjectIcon className="muted" />
          <span className={current ? undefined : 'muted'}>{current?.name ?? 'No project'}</span>
        </>
      }
    />
  );
}

export function CyclePicker({
  teamId,
  value,
  onChange,
  variant = 'full',
}: {
  teamId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: 'full' | 'chip';
}) {
  const { data: cycles = [] } = useCycles(teamId);
  const current = cycles.find((c) => c.id === value);
  return (
    <PropertyPicker
      label="Cycle"
      triggerLabel={`Cycle: ${current ? `Cycle ${current.number}` : 'No cycle'}`}
      value={value ?? ''}
      options={[{ value: '', label: 'No cycle' }, ...cycles.map((c) => ({ value: c.id, label: cycleName(c) }))]}
      onChange={(v) => onChange(v || null)}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={<span className={current ? undefined : 'muted'}>{current ? cycleName(current) : 'No cycle'}</span>}
    />
  );
}

export function EstimatePicker({
  value,
  onChange,
  variant = 'full',
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  variant?: 'full' | 'chip';
}) {
  return (
    <PropertyPicker
      label="Estimate"
      triggerLabel={`Estimate: ${formatEstimate(value)}`}
      value={value === null ? '' : String(value)}
      options={[
        { value: '', label: 'No estimate' },
        ...ESTIMATE_OPTIONS.map((n) => ({ value: String(n), label: formatEstimate(n) })),
      ]}
      onChange={(v) => onChange(v === '' ? null : Number(v))}
      className={rootClass(variant)}
      triggerClassName={styles[variant]}
      trigger={<span className={value === null ? 'muted' : undefined}>{formatEstimate(value)}</span>}
    />
  );
}

export function DueDateField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <input
      type="date"
      className={styles.date}
      aria-label="Due date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}
