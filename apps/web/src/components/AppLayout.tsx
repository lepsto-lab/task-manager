import { Component, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { useNewIssue } from '../lib/newIssue';
import styles from './AppLayout.module.css';
import { Sidebar } from './Sidebar';
import { ErrorState } from './states';

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorState error={this.state.error} onRetry={() => window.location.reload()} retryLabel="Reload" />;
  }
}

export function AppLayout() {
  const newIssue = useNewIssue();
  return (
    <div className={styles.shell}>
      <Sidebar onNewIssue={(teamId) => newIssue.open({ teamId })} />
      <main className={styles.panel}>
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
