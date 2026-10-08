import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  InboxReadInput,
  InboxResponse,
  IssueDetail,
  IssueListItem,
  IssueUpdateInput,
  Label,
  User,
  ViewUpdateInput,
} from '@tm/shared';
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
    mutationKey: ['updateIssue'],
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
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['updateIssue'] }) === 1) return invalidateIssueData(qc);
    },
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createView, onSuccess: () => qc.invalidateQueries({ queryKey: qk.views }) });
}

export function useDeleteIssue() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: api.deleteIssue,
    // Detail queries are left alone so the open page does not refetch a 404 before navigating away.
    onSuccess: () => invalidateIssueData(qc, ISSUE_DATA_KEYS.filter((key) => key !== 'issue')),
    onError: (error) => toast.show(`Couldn't delete: ${error.message}`, 'error'),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) => api.addComment(issueId, body),
    onSuccess: () => invalidateIssueData(qc, ['issue', 'inbox']),
    onError: (error) => toast.show(`Couldn't post comment: ${error.message}`, 'error'),
  });
}

export function useMarkRead(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InboxReadInput) => api.markRead(input),
    onMutate: async (input) => {
      const key = qk.inbox(userId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InboxResponse>(key);
      if (previous) {
        const ids = 'all' in input ? null : new Set(input.activityIds);
        const items = previous.items.map((item) =>
          ids === null || ids.has(item.activity.id) ? { ...item, read: true } : item,
        );
        qc.setQueryData<InboxResponse>(key, { items, unreadCount: items.filter((i) => !i.read).length });
      }
      return { key, previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(context.key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
    onError: (error) => toast.show(`Couldn't create project: ${error.message}`, 'error'),
  });
}

export function useUpdateView(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: ViewUpdateInput) => api.updateView(id, input),
    onSuccess: (view) => {
      qc.setQueryData(qk.view(id), view);
      void qc.invalidateQueries({ queryKey: qk.views });
    },
    onError: (error) => toast.show(`Couldn't save view: ${error.message}`, 'error'),
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: api.deleteView,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.views }),
    onError: (error) => toast.show(`Couldn't delete view: ${error.message}`, 'error'),
  });
}
