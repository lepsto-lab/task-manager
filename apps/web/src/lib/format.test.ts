import { describe, expect, it } from 'vitest';
import { cycleName, formatEstimate, formatRange, formatShortDate } from './format';

describe('format', () => {
  it('formats date-only values without timezone drift', () => {
    expect(formatShortDate('2026-10-17')).toBe('Oct 17');
    expect(formatShortDate('2026-01-01')).toBe('Jan 1');
  });

  it('formats timestamps', () => {
    expect(formatShortDate('2026-10-07T12:00:00.000Z')).toBe('Oct 7');
  });

  it('formats ranges within and across months', () => {
    expect(formatRange('2026-10-06', '2026-10-19')).toBe('Oct 6–19');
    expect(formatRange('2026-09-29', '2026-10-12')).toBe('Sep 29–Oct 12');
  });

  it('formats estimates', () => {
    expect(formatEstimate(null)).toBe('No estimate');
    expect(formatEstimate(1)).toBe('1 point');
    expect(formatEstimate(5)).toBe('5 points');
  });

  it('names cycles', () => {
    expect(cycleName({ number: 14, startsOn: '2026-10-06', endsOn: '2026-10-19' })).toBe('Cycle 14 · Oct 6–19');
  });
});
