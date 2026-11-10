import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'tontine-menoje:v1:';

const canUseStorage = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

export const readStoredState = <T>(key: string): T | undefined => {
  if (!canUseStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
};

export const writeStoredState = <T>(key: string, value: T): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private mode: keep working with in-memory state.
  }
};

export const clearStoredState = (): void => {
  if (!canUseStorage()) return;
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage errors.
  }
};

/**
 * useState backed by localStorage. The seed value is only used when nothing
 * has been stored yet, so demo data survives page reloads until reset.
 *
 * `enabled = false` désactive complètement la persistance (mode API : les
 * données viennent du serveur et ne doivent pas être mises en cache locale).
 */
export const usePersistentState = <T>(key: string, initial: T | (() => T), enabled = true) => {
  const [value, setValue] = useState<T>(() => {
    if (!enabled) return typeof initial === 'function' ? (initial as () => T)() : initial;
    const stored = readStoredState<T>(key);
    if (stored !== undefined) return stored;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    if (enabled) writeStoredState(key, value);
  }, [key, value, enabled]);

  return [value, setValue] as const;
};
