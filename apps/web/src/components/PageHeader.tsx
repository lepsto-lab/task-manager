import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronIcon } from './icons';
import styles from './PageHeader.module.css';

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export function PageHeader({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="Breadcrumbs">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronIcon className={styles.sep} />}
              {crumb.to ? (
                <Link to={crumb.to} className={styles.crumb}>
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? styles.current : styles.crumb}>{crumb.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>
      {children}
    </header>
  );
}
