const ISSUE_KEY_RE = /^([A-Z][A-Z0-9]{0,9})-([1-9]\d{0,8})$/;

export function parseIssueKey(key: string): { teamKey: string; number: number } | null {
  const match = ISSUE_KEY_RE.exec(key.trim().toUpperCase());
  if (!match) return null;
  return { teamKey: match[1], number: Number(match[2]) };
}

export function formatIssueKey(teamKey: string, number: number): string {
  return `${teamKey}-${number}`;
}
