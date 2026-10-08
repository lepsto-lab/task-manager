import { useEffect, useState } from 'react';

export function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(value);
  }, [value, dirty]);
  const edit = (next: string) => {
    setDraft(next);
    setDirty(true);
  };
  const reset = () => {
    setDraft(value);
    setDirty(false);
  };
  return { draft, dirty, edit, reset, clean: () => setDirty(false) };
}
