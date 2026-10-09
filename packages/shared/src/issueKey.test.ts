import { describe, expect, it } from 'vitest';
import { formatIssueKey, parseIssueKey } from './issueKey';

describe('parseIssueKey', () => {
  it('parses a valid key', () => {
    expect(parseIssueKey('DEV-142')).toEqual({ teamKey: 'DEV', number: 142 });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseIssueKey(' dev-7 ')).toEqual({ teamKey: 'DEV', number: 7 });
  });

  it.each(['', 'DEV', 'DEV-', 'DEV-0', 'DEV-01', '-1', 'DEV-1-2', 'D E-1', 'DEV-1234567890', '1DEV-2'])(
    'rejects %j',
    (key) => {
      expect(parseIssueKey(key)).toBeNull();
    },
  );
});

describe('formatIssueKey', () => {
  it('joins team key and number', () => {
    expect(formatIssueKey('DES', 12)).toBe('DES-12');
  });
});
