import { PRIORITY_LABELS, STATUS_LABELS, type ActivityEntry, type IssuePriority, type IssueStatus } from '@tm/shared';
import { formatEstimate, formatShortDate } from './format';

interface Payload {
  from?: unknown;
  to?: unknown;
  added?: string[];
  removed?: string[];
}

const plural = (word: string, n: number) => (n === 1 ? word : `${word}s`);

export function describeActivity(entry: Pick<ActivityEntry, 'type' | 'payload'>): string {
  const p = entry.payload as Payload;
  const to = p.to ?? null;
  switch (entry.type) {
    case 'created':
      return 'created the issue';
    case 'status':
      return `moved to ${STATUS_LABELS[to as IssueStatus]}`;
    case 'priority':
      return to === 'none' ? 'removed the priority' : `set priority to ${PRIORITY_LABELS[to as IssuePriority]}`;
    case 'assignee':
      return to ? `assigned to ${String(to)}` : 'removed the assignee';
    case 'title':
      return `renamed the issue to “${String(to)}”`;
    case 'labels': {
      const parts: string[] = [];
      if (p.added?.length) parts.push(`added ${plural('label', p.added.length)} ${p.added.join(', ')}`);
      if (p.removed?.length) parts.push(`removed ${plural('label', p.removed.length)} ${p.removed.join(', ')}`);
      return parts.join(' and ');
    }
    case 'project':
      return to ? `moved to project ${String(to)}` : 'removed the project';
    case 'cycle':
      return to ? `added to ${String(to)}` : 'removed the cycle';
    case 'due_date':
      return to ? `set due date to ${formatShortDate(String(to))}` : 'removed the due date';
    case 'estimate':
      return to === null ? 'removed the estimate' : `set estimate to ${formatEstimate(Number(to))}`;
    case 'parent':
      return to ? `made this a sub-issue of ${String(to)}` : 'removed the parent issue';
    case 'comment':
      return 'commented';
  }
}
