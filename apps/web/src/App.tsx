import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useTeams } from './api/queries';
import { AppLayout } from './components/AppLayout';
import { EmptyState, ListSkeleton } from './components/states';
import { CurrentUserProvider } from './lib/currentUser';
import { NewIssueProvider } from './lib/newIssue';
import { ToastProvider } from './lib/toast';
import { BoardPage } from './pages/BoardPage';
import { CyclePage } from './pages/CyclePage';
import { CyclesPage } from './pages/CyclesPage';
import { IssueListPage } from './pages/IssueListPage';
import { InboxPage } from './pages/InboxPage';
import { IssuePage } from './pages/IssuePage';
import { MyIssuesPage } from './pages/MyIssuesPage';
import { NotFound } from './pages/NotFound';
import { ProjectPage } from './pages/ProjectPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ViewPage } from './pages/ViewPage';
import { ViewsPage } from './pages/ViewsPage';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CurrentUserProvider>
        <NewIssueProvider>{children}</NewIssueProvider>
      </CurrentUserProvider>
    </ToastProvider>
  );
}

function HomeRedirect() {
  const { data: teams, isPending } = useTeams();
  if (isPending) return <ListSkeleton />;
  const first = teams?.[0];
  return first ? <Navigate to={`/team/${first.key}/issues`} replace /> : <EmptyState title="No teams yet" />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="team/:teamKey/issues" element={<IssueListPage />} />
        <Route path="team/:teamKey/board" element={<BoardPage />} />
        <Route path="issue/:issueKey" element={<IssuePage />} />
        <Route path="my-issues" element={<MyIssuesPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="team/:teamKey/cycles" element={<CyclesPage />} />
        <Route path="cycles/:id" element={<CyclePage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectPage />} />
        <Route path="views" element={<ViewsPage />} />
        <Route path="views/:id" element={<ViewPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
