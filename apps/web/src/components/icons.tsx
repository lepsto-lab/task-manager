import { PRIORITY_LABELS, STATUS_LABELS, type IssuePriority, type IssueStatus } from '@tm/shared';
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function icon(size: number, children: ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const SearchIcon = icon(
  16,
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13.5 13.5" />
  </>,
);
export const PencilIcon = icon(16, <path d="M11 2.5l2.5 2.5L7 11.5H4.5V9z" />);
export const InboxIcon = icon(
  16,
  <>
    <rect x="2.5" y="3" width="11" height="10" rx="2" />
    <path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" />
  </>,
);
export const MyIssuesIcon = icon(
  16,
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.8 8.2l1.5 1.5 3-3" />
  </>,
);
export const ProjectIcon = icon(14, <path d="M8 2l5.5 3v6L8 14l-5.5-3V5z" />);
export const ViewsIcon = icon(
  16,
  <>
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
  </>,
);
export const PlusIcon = icon(14, <path d="M8 3v10M3 8h10" />);
export const ChevronIcon = icon(12, <path d="M6 4l4 4-4 4" />);
export const FilterIcon = icon(14, <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />);
export const ListIcon = icon(14, <path d="M3 4h10M3 8h10M3 12h10" />);
export const BoardIcon = icon(
  14,
  <>
    <rect x="2.5" y="2.5" width="4" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="4" height="7" rx="1" />
  </>,
);
export const DisplayIcon = icon(
  14,
  <>
    <path d="M3 5h10M3 11h10" />
    <circle cx="6" cy="5" r="1.5" style={{ fill: 'var(--panel)' }} />
    <circle cx="10" cy="11" r="1.5" style={{ fill: 'var(--panel)' }} />
  </>,
);
export const CheckIcon = icon(14, <path d="M3.5 8.5l3 3 6-7" />);
export const TrashIcon = icon(14, <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />);
export const CloseIcon = icon(14, <path d="M4 4l8 8M12 4l-8 8" />);

export function StatusIcon({ status, size = 14 }: { status: IssueStatus; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 14 14', role: 'img', 'aria-label': STATUS_LABELS[status] };
  switch (status) {
    case 'backlog':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" strokeDasharray="2 2" style={{ stroke: 'var(--status-backlog)' }} />
        </svg>
      );
    case 'todo':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" style={{ stroke: 'var(--status-todo)' }} />
        </svg>
      );
    case 'in_progress':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" style={{ stroke: 'var(--status-progress)' }} />
          <path d="M7 3.5 A3.5 3.5 0 0 1 7 10.5 Z" style={{ fill: 'var(--status-progress)' }} />
        </svg>
      );
    case 'in_review':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="none" strokeWidth="1.5" style={{ stroke: 'var(--status-review)' }} />
          <path d="M7 3.5 A3.5 3.5 0 1 1 3.5 7 L7 7 Z" style={{ fill: 'var(--status-review)' }} />
        </svg>
      );
    case 'done':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6.5" style={{ fill: 'var(--accent)' }} />
          <path d="M4.4 7.2 L6.2 9 L9.6 5.4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function PriorityIcon({ priority, size = 14 }: { priority: IssuePriority; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 14 14', role: 'img', 'aria-label': PRIORITY_LABELS[priority] };
  if (priority === 'urgent') {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="12" height="12" rx="3" style={{ fill: 'var(--priority-urgent)' }} />
        <rect x="6.25" y="3.4" width="1.5" height="4.6" rx="0.5" style={{ fill: 'var(--panel)' }} />
        <rect x="6.25" y="9.2" width="1.5" height="1.5" rx="0.5" style={{ fill: 'var(--panel)' }} />
      </svg>
    );
  }
  if (priority === 'none') {
    return (
      <svg {...common}>
        <rect x="1.5" y="6.25" width="2.5" height="1.5" rx="0.75" style={{ fill: 'var(--text-muted)' }} />
        <rect x="5.75" y="6.25" width="2.5" height="1.5" rx="0.75" style={{ fill: 'var(--text-muted)' }} />
        <rect x="10" y="6.25" width="2.5" height="1.5" rx="0.75" style={{ fill: 'var(--text-muted)' }} />
      </svg>
    );
  }
  const middle = priority === 'low' ? 0.3 : 1;
  const top = priority === 'high' ? 1 : 0.3;
  return (
    <svg {...common}>
      <rect x="1.5" y="8" width="3" height="4.5" rx="1" style={{ fill: 'var(--priority-bars)' }} />
      <rect x="5.5" y="5" width="3" height="7.5" rx="1" opacity={middle} style={{ fill: 'var(--priority-bars)' }} />
      <rect x="9.5" y="2" width="3" height="10.5" rx="1" opacity={top} style={{ fill: 'var(--priority-bars)' }} />
    </svg>
  );
}
