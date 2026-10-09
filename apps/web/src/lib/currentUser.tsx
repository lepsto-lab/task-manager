import type { User } from '@tm/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { setApiUser } from '../api/client';
import { useUsers } from '../api/queries';
import { storage } from './storage';

const STORAGE_KEY = 'tm.currentUserId';

interface CurrentUserValue {
  user: User | null;
  users: User[];
  setUserId: (id: string) => void;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { data: users } = useUsers();
  const [userId, setUserIdState] = useState<string | null>(() => storage.get(STORAGE_KEY));
  const list = useMemo(() => users ?? [], [users]);
  const user = list.find((u) => u.id === userId) ?? list[0] ?? null;
  // Set synchronously so requests fired by children during this render cycle carry the header.
  setApiUser(user?.id ?? null);

  const value = useMemo<CurrentUserValue>(
    () => ({
      user,
      users: list,
      setUserId: (id) => {
        storage.set(STORAGE_KEY, id);
        setUserIdState(id);
      },
    }),
    [user, list],
  );
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return value;
}
