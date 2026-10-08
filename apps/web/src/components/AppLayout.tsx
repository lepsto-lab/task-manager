import { Outlet } from 'react-router';
import { useNewIssue } from '../lib/newIssue';
import styles from './AppLayout.module.css';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const newIssue = useNewIssue();
  return (
    <div className={styles.shell}>
      <Sidebar onNewIssue={() => newIssue.open()} />
      <main className={styles.panel}>
        <Outlet />
      </main>
    </div>
  );
}
