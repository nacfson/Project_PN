import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getUserLanguages, setActiveUserLanguage } from '../api/userLanguages';
import type { UserLanguage } from '../types/auth';

interface LanguageContextValue {
  languages: UserLanguage[];
  targetLanguage: string | null;
  displayLanguage: string | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
  setActive: (targetLanguage: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [languages, setLanguages] = useState<UserLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const hasInitialLoadedRef = useRef(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    if (hasInitialLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    getUserLanguages()
      .then((data) => {
        if (!active) return;
        setLanguages(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load languages');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setIsRefreshing(false);
          hasInitialLoadedRef.current = true;
        }
      });
    return () => { active = false; };
  }, [tick]);

  const activeLanguage = useMemo(
    () => languages.find((l) => l.is_active) ?? languages[0] ?? null,
    [languages],
  );

  const setActive = useCallback(
    async (targetLanguage: string) => {
      try {
        await setActiveUserLanguage(targetLanguage);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set active language');
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      languages,
      targetLanguage: activeLanguage?.target_language ?? null,
      displayLanguage: activeLanguage?.display_language ?? null,
      loading,
      isRefreshing,
      error,
      refresh,
      setActive,
    }),
    [languages, activeLanguage, loading, isRefreshing, error, refresh, setActive],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
