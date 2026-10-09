import type { Label, Team, User } from '@tm/shared';
import styles from './primitives.module.css';

export function Avatar({ user, size = 22 }: { user: User | null; size?: number }) {
  if (!user) {
    return <span className={styles.noAvatar} style={{ width: size, height: size }} aria-label="No assignee" role="img" />;
  }
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, background: user.color, fontSize: Math.round(size * 0.45) }}
      title={user.name}
      aria-hidden="true"
    >
      {user.initials}
    </span>
  );
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className={styles.chip}>
      <span className={styles.dot} style={{ background: label.color }} />
      {label.name}
    </span>
  );
}

export function TeamBadge({ team }: { team: Team }) {
  return (
    <span className={styles.team} style={{ background: team.color }} aria-hidden="true">
      {team.name.charAt(0)}
    </span>
  );
}

export function TeamCrumb({ team }: { team: Team }) {
  return (
    <span className={styles.crumb}>
      <TeamBadge team={team} />
      {team.name}
    </span>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className={styles.progress} aria-label={`${done} of ${total} done`}>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </span>
      <span className="muted">
        {done}/{total}
      </span>
    </span>
  );
}
