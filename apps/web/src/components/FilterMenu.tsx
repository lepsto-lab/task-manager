import { BOARD_STATUS_ORDER, ISSUE_PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from '@tm/shared';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useCycles, useLabels, useProjects, useUsers } from '../api/queries';
import { countFilters, type FilterFields } from '../lib/filters';
import { cycleName } from '../lib/format';
import { useDismiss } from '../lib/useDismiss';
import styles from './FilterMenu.module.css';
import { FilterIcon, PriorityIcon, StatusIcon } from './icons';
import { Avatar } from './primitives';

type ArrayKey = 'status' | 'priority' | 'assigneeId' | 'labelId';

function Check({ checked, onToggle, icon, label }: { checked: boolean; onToggle: () => void; icon?: ReactNode; label: string }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </label>
  );
}

export function FilterMenu({
  teamId,
  value,
  onChange,
  onSaveView,
}: {
  teamId?: string;
  value: FilterFields;
  onChange: (filters: FilterFields) => void;
  onSaveView?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);
  const { data: users = [] } = useUsers();
  const { data: labels = [] } = useLabels(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: cycles = [] } = useCycles(teamId);
  const count = countFilters(value);

  const toggle = (key: ArrayKey, item: string) => {
    const current = (value[key] ?? []) as string[];
    const next = current.includes(item) ? current.filter((v) => v !== item) : [...current, item];
    onChange({ ...value, [key]: next.length ? next : undefined });
  };
  const has = (key: ArrayKey, item: string) => ((value[key] ?? []) as string[]).includes(item);

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <FilterIcon />
        Filter
        {count > 0 && <span className={styles.badge}>{count}</span>}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Filters">
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Status</legend>
            {BOARD_STATUS_ORDER.map((s) => (
              <Check key={s} checked={has('status', s)} onToggle={() => toggle('status', s)} icon={<StatusIcon status={s} />} label={STATUS_LABELS[s]} />
            ))}
          </fieldset>
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Priority</legend>
            {ISSUE_PRIORITIES.map((p) => (
              <Check key={p} checked={has('priority', p)} onToggle={() => toggle('priority', p)} icon={<PriorityIcon priority={p} />} label={PRIORITY_LABELS[p]} />
            ))}
          </fieldset>
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Assignee</legend>
            {users.map((u) => (
              <Check key={u.id} checked={has('assigneeId', u.id)} onToggle={() => toggle('assigneeId', u.id)} icon={<Avatar user={u} size={16} />} label={u.name} />
            ))}
          </fieldset>
          {labels.length > 0 && (
            <fieldset className={styles.section}>
              <legend className={styles.legend}>Labels</legend>
              {labels.map((l) => (
                <Check key={l.id} checked={has('labelId', l.id)} onToggle={() => toggle('labelId', l.id)} label={l.name} />
              ))}
            </fieldset>
          )}
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Project</legend>
            <select
              className={`input ${styles.select}`}
              aria-label="Project filter"
              value={value.projectId ?? ''}
              onChange={(e) => onChange({ ...value, projectId: e.target.value || undefined })}
            >
              <option value="">Any project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </fieldset>
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Cycle</legend>
            <select
              className={`input ${styles.select}`}
              aria-label="Cycle filter"
              value={value.cycleId ?? ''}
              onChange={(e) => onChange({ ...value, cycleId: e.target.value || undefined })}
            >
              <option value="">Any cycle</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {cycleName(c)}
                </option>
              ))}
            </select>
          </fieldset>
          <div className={styles.footer}>
            <button type="button" className="btn" disabled={count === 0} onClick={() => onChange({})}>
              Clear
            </button>
            {onSaveView &&
              (saving ? (
                <form
                  className={styles.saveForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!name.trim()) return;
                    onSaveView(name.trim());
                    setSaving(false);
                    setName('');
                    setOpen(false);
                  }}
                >
                  <input autoFocus className="input" placeholder="View name" aria-label="View name" value={name} onChange={(e) => setName(e.target.value)} />
                  <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                    Save
                  </button>
                </form>
              ) : (
                <button type="button" className="btn" onClick={() => setSaving(true)}>
                  Save as view
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
