import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { useDismiss } from '../lib/useDismiss';
import { CheckIcon } from './icons';
import styles from './PropertyPicker.module.css';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface BaseProps<T extends string> {
  label: string;
  triggerLabel?: string;
  options: PickerOption<T>[];
  trigger: ReactNode;
  triggerClassName?: string;
  className?: string;
  searchable?: boolean;
  /** Which edge of the trigger the popover aligns to. */
  align?: 'start' | 'end';
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
}

interface MultipleProps<T extends string> extends BaseProps<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}

export function PropertyPicker<T extends string>(props: SingleProps<T> | MultipleProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, close);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open || props.searchable) return;
    const options = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    const target = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? options?.[0];
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = new Set<string>(props.multiple ? props.value : [props.value]);
  const needle = query.trim().toLowerCase();
  const shown = props.options.filter((o) => o.label.toLowerCase().includes(needle));

  const pick = (value: T) => {
    if (props.multiple) {
      props.onChange(selected.has(value) ? props.value.filter((v) => v !== value) : [...props.value, value]);
      return;
    }
    setOpen(false);
    triggerRef.current?.focus();
    if (value !== props.value) props.onChange(value);
  };

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, open && styles.open, props.className)}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (open && next && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={props.triggerClassName ?? styles.trigger}
        aria-label={props.triggerLabel ?? props.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setQuery('');
          setOpen((o) => !o);
        }}
      >
        {props.trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          className={cx(styles.popover, props.align === 'end' && styles.end)}
          role="listbox"
          aria-label={props.label}
          aria-multiselectable={props.multiple || undefined}
        >
          {props.searchable && (
            <input
              autoFocus
              className={styles.search}
              placeholder={`${props.label}…`}
              aria-label={`Filter ${props.label.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {shown.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected.has(option.value)}
              className={styles.option}
              onClick={() => pick(option.value)}
            >
              <span className={styles.optionIcon} aria-hidden="true">{option.icon}</span>
              <span className={styles.optionLabel}>{option.label}</span>
              {selected.has(option.value) && <CheckIcon className={styles.check} />}
            </button>
          ))}
          {shown.length === 0 && <div className={styles.empty}>No results</div>}
        </div>
      )}
    </div>
  );
}
