import { Link } from 'react-router';
import { cx } from '../lib/cx';
import { BoardIcon, ListIcon } from './icons';
import styles from './ViewToggle.module.css';

export function ViewToggle({ teamKey, active, search }: { teamKey: string; active: 'list' | 'board'; search: URLSearchParams }) {
  const query = search.toString();
  const suffix = query ? `?${query}` : '';
  return (
    <div className={styles.toggle}>
      <Link
        to={`/team/${teamKey}/issues${suffix}`}
        aria-label="List"
        aria-current={active === 'list' ? 'page' : undefined}
        className={cx(styles.option, active === 'list' && styles.active)}
      >
        <ListIcon />
      </Link>
      <Link
        to={`/team/${teamKey}/board${suffix}`}
        aria-label="Board"
        aria-current={active === 'board' ? 'page' : undefined}
        className={cx(styles.option, active === 'board' && styles.active)}
      >
        <BoardIcon />
      </Link>
    </div>
  );
}
