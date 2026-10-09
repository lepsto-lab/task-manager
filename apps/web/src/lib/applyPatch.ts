import type { IssueListItem, IssueUpdateInput, Label, User } from '@tm/shared';

export function applyPatch<T extends IssueListItem>(
  issue: T,
  patch: IssueUpdateInput,
  ctx: { users: User[]; labels: Label[] },
): T {
  const { assigneeId, labelIds, description, ...scalars } = patch;
  const next: IssueListItem & { description?: string } = { ...issue, ...scalars };
  if (assigneeId !== undefined) next.assignee = ctx.users.find((u) => u.id === assigneeId) ?? null;
  if (labelIds !== undefined) {
    next.labels = labelIds.map((id) => ctx.labels.find((l) => l.id === id)).filter((l): l is Label => !!l);
  }
  if (description !== undefined && 'description' in next) next.description = description;
  return next as T;
}
