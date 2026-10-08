import { Outlet } from 'react-router';
import styles from './AppLayout.module.css';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.panel}>
        <Outlet />
      </main>
    </div>
  );
}
