import type { IssueStatus } from '@tm/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { NewIssueModal } from '../components/NewIssueModal';

export interface NewIssueDefaults {
  teamId?: string;
  status?: IssueStatus;
  parentId?: string | null;
  projectId?: string | null;
  cycleId?: string | null;
}

interface NewIssueValue {
  open: (defaults?: NewIssueDefaults) => void;
}

const NewIssueContext = createContext<NewIssueValue | null>(null);

export function NewIssueProvider({ children }: { children: ReactNode }) {
  const [defaults, setDefaults] = useState<NewIssueDefaults | null>(null);
  const value = useMemo<NewIssueValue>(() => ({ open: (d = {}) => setDefaults(d) }), []);
  return (
    <NewIssueContext.Provider value={value}>
      {children}
      {defaults && <NewIssueModal defaults={defaults} onClose={() => setDefaults(null)} />}
    </NewIssueContext.Provider>
  );
}

export function useNewIssue(): NewIssueValue {
  const value = useContext(NewIssueContext);
  if (!value) throw new Error('useNewIssue must be used inside NewIssueProvider');
  return value;
}
