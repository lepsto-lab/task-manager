import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { IssueDetail, IssueListItem, IssueUpdateInput, Label, User } from '@tm/shared';
import { applyPatch } from '../lib/applyPatch';
import { useToast } from '../lib/toast';
import { api } from './client';
import { qk } from './queries';

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

export function useUpdateIssue() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IssueUpdateInput }) => api.updateIssue(id, patch),
    onMutate: async ({ id, patch }) => {
      await Promise.all([qc.cancelQueries({ queryKey: ['issues'] }), qc.cancelQueries({ queryKey: ['issue'] })]);
      const lists = qc.getQueriesData<IssueListItem[]>({ queryKey: ['issues'] });
      const details = qc.getQueriesData<IssueDetail>({ queryKey: ['issue'] });
      const ctx = {
        users: qc.getQueryData<User[]>(qk.users) ?? [],
        labels: qc.getQueriesData<Label[]>({ queryKey: ['labels'] }).flatMap(([, data]) => data ?? []),
      };
      const apply = (issue: IssueListItem) => (issue.id === id ? applyPatch(issue, patch, ctx) : issue);
      for (const [key, data] of lists) if (data) qc.setQueryData(key, data.map(apply));
      for (const [key, data] of details) {
        if (!data) continue;
        const base = data.id === id ? applyPatch(data, patch, ctx) : data;
        qc.setQueryData<IssueDetail>(key, { ...base, children: base.children.map(apply) });
      }
      return { lists, details };
    },
    onError: (error, _vars, context) => {
      context?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      context?.details.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.show(`Couldn't save: ${error.message}`, 'error');
    },
    onSettled: () => invalidateIssueData(qc),
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createView, onSuccess: () => qc.invalidateQueries({ queryKey: qk.views }) });
}
