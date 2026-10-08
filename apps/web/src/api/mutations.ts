import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';

export const ISSUE_DATA_KEYS = ['issues', 'issue', 'inbox', 'projects', 'project', 'cycles', 'cycle'] as const;

export async function invalidateIssueData(
  qc: QueryClient,
  keys: readonly string[] = ISSUE_DATA_KEYS,
): Promise<void> {
  await Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key] })));
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createIssue, onSuccess: () => invalidateIssueData(qc) });
}
