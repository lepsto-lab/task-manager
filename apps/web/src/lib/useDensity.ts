import { useCallback, useState } from 'react';
import { storage } from './storage';

export type Density = 'comfortable' | 'compact';

const KEY = 'tm.density';

export function useDensity(): [Density, (density: Density) => void] {
  const [density, setDensity] = useState<Density>(() => (storage.get(KEY) === 'compact' ? 'compact' : 'comfortable'));
  const update = useCallback((next: Density) => {
    storage.set(KEY, next);
    setDensity(next);
  }, []);
  return [density, update];
}
