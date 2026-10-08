import type { ReactNode } from 'react';
import { useState } from 'react';
import { parseIssueKey } from '@tm/shared';
import { NavLink, useLocation } from 'react-router';
import { useInbox, useTeams } from '../api/queries';
import { useCurrentUser } from '../lib/currentUser';
import { cx } from '../lib/cx';
import { ChevronIcon, InboxIcon, MyIssuesIcon, PencilIcon, PlusIcon, ProjectIcon, SearchIcon, ViewsIcon } from './icons';
import { Avatar, TeamBadge } from './primitives';
import styles from './Sidebar.module.css';

function NavItem({ to, icon, label, count }: { to: string; icon: ReactNode; label: string; count?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) => cx(styles.item, isActive && styles.active)}>
      {icon}
      <span className={styles.label}>{label}</span>
      {!!count && (
        <span className={styles.count} aria-label={`${count} unread`}>
          {count}
        </span>
      )}
    </NavLink>
  );
}

function teamKeyFromPath(pathname: string): string | null {
  const team = /^\/team\/([^/]+)/.exec(pathname);
  if (team) return decodeURIComponent(team[1]);
  const issue = /^\/issue\/([^/]+)/.exec(pathname);
  return issue ? (parseIssueKey(decodeURIComponent(issue[1]))?.teamKey ?? null) : null;
}

export function Sidebar({ onNewIssue }: { onNewIssue?: () => void }) {
  const { data: teams = [] } = useTeams();
  const { user, users, setUserId } = useCurrentUser();
  const { data: inbox } = useInbox(user?.id ?? null);
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const activeTeamKey = teamKeyFromPath(pathname);

  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.workspace}>
        <span className={styles.logo} aria-hidden="true">
          M
        </span>
        <span className={styles.workspaceName}>My workspace</span>
        <button type="button" className="icon-btn" aria-label="Search" title="Search is coming soon" disabled>
          <SearchIcon />
        </button>
        <button type="button" className={styles.newIssue} aria-label="New issue" onClick={onNewIssue}>
          <PencilIcon />
        </button>
      </div>

      <div className={styles.group}>
        <NavItem to="/inbox" icon={<InboxIcon />} label="Inbox" count={inbox?.unreadCount} />
        <NavItem to="/my-issues" icon={<MyIssuesIcon />} label="My issues" />
      </div>

      <div className={styles.group}>
        <div className={styles.heading}>Workspace</div>
        <NavItem to="/projects" icon={<ProjectIcon width={16} height={16} />} label="Projects" />
        <NavItem to="/views" icon={<ViewsIcon />} label="Views" />
      </div>

      <div className={styles.group}>
        <div className={styles.heading}>Your teams</div>
        {teams.map((team, index) => {
          const base = `/team/${team.key}`;
          const open = expanded[team.id] ?? (activeTeamKey ? team.key === activeTeamKey : index === 0);
          const issuesActive = pathname.startsWith(`${base}/issues`) || pathname.startsWith(`${base}/board`);
          return (
            <div key={team.id} className={styles.group}>
              <button
                type="button"
                className={styles.team}
                aria-expanded={open}
                onClick={() => setExpanded((e) => ({ ...e, [team.id]: !open }))}
              >
                <TeamBadge team={team} />
                <span className={styles.label}>{team.name}</span>
                <ChevronIcon className={open ? styles.chevronOpen : styles.chevron} />
              </button>
              {open && (
                <>
                  <NavLink to={`${base}/issues`} className={cx(styles.sub, issuesActive && styles.active)}>
                    Issues
                  </NavLink>
                  <NavLink to={`${base}/cycles`} className={({ isActive }) => cx(styles.sub, isActive && styles.active)}>
                    Cycles
                  </NavLink>
                  <NavLink to={`/projects?teamId=${team.id}`} className={styles.sub}>
                    Projects
                  </NavLink>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.item} disabled title="Invites need accounts, which are not enabled yet">
          <PlusIcon />
          <span className={styles.label}>Invite people</span>
        </button>
        <div className={styles.userSwitch}>
          <Avatar user={user} size={18} />
          <select
            className={styles.userSelect}
            aria-label="Current user"
            value={user?.id ?? ''}
            onChange={(e) => setUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}
