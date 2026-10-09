const local = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const utc = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatShortDate(value: string): string {
  return DATE_ONLY.test(value) ? utc.format(new Date(`${value}T00:00:00Z`)) : local.format(new Date(value));
}

export function formatRange(start: string, end: string): string {
  const from = formatShortDate(start);
  const to = formatShortDate(end);
  const [fromMonth] = from.split(' ');
  const [toMonth, toDay] = to.split(' ');
  return fromMonth === toMonth ? `${from}–${toDay}` : `${from}–${to}`;
}

export function formatEstimate(points: number | null): string {
  if (points === null) return 'No estimate';
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

export function cycleName(cycle: { number: number; startsOn: string; endsOn: string }): string {
  return `Cycle ${cycle.number} · ${formatRange(cycle.startsOn, cycle.endsOn)}`;
}
