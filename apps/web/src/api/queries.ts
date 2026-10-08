import type { IssueFilters } from '@tm/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export const qk = {
  users: ['users'] as const,
  teams: ['teams'] as const,
  labels: (teamId?: string) => ['labels', teamId ?? 'all'] as const,
  projects: (teamId?: string) => ['projects', teamId ?? 'all'] as const,
  project: (id: string) => ['project', id] as const,
  cycles: (teamId?: string) => ['cycles', teamId ?? 'all'] as const,
  cycle: (id: string) => ['cycle', id] as const,
  issues: (filters: IssueFilters, scope = '') => ['issues', filters, scope] as const,
  issue: (key: string) => ['issue', key.toUpperCase()] as const,
  inbox: (userId: string | null) => ['inbox', userId] as const,
  views: ['views'] as const,
  view: (id: string) => ['view', id] as const,
};

export const useUsers = () => useQuery({ queryKey: qk.users, queryFn: api.users, staleTime: 60_000 });

export const useTeams = () => useQuery({ queryKey: qk.teams, queryFn: api.teams, staleTime: 60_000 });

export function useTeamByKey(key: string) {
  const query = useTeams();
  return {
    team: query.data?.find((t) => t.key === key.toUpperCase()),
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export const useLabels = (teamId?: string) =>
  useQuery({ queryKey: qk.labels(teamId), queryFn: () => api.labels(teamId), staleTime: 60_000 });

export const useProjects = (teamId?: string) =>
  useQuery({ queryKey: qk.projects(teamId), queryFn: () => api.projects(teamId) });

export const useProject = (id: string) => useQuery({ queryKey: qk.project(id), queryFn: () => api.project(id) });

export const useCycles = (teamId?: string) =>
  useQuery({ queryKey: qk.cycles(teamId), queryFn: () => api.cycles(teamId) });

export const useCycle = (id: string) => useQuery({ queryKey: qk.cycle(id), queryFn: () => api.cycle(id) });

export function useIssues(filters: IssueFilters, options: { scope?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.issues(filters, options.scope),
    queryFn: () => api.issues(filters),
    enabled: options.enabled ?? true,
  });
}

export const useIssue = (key: string) => useQuery({ queryKey: qk.issue(key), queryFn: () => api.issue(key) });

/** Pass the current user's id: the inbox is per user and must refetch when the user switches. */
export function useInbox(userId: string | null) {
  return useQuery({ queryKey: qk.inbox(userId), queryFn: api.inbox, enabled: !!userId });
}

export const useViews = () => useQuery({ queryKey: qk.views, queryFn: api.views });

export const useView = (id: string) => useQuery({ queryKey: qk.view(id), queryFn: () => api.view(id) });
