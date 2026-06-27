import { useCallback, useEffect, useState } from 'react';
import { getUserLanguages } from '../api/userLanguages';
import type { UserLanguage } from '../types/auth';

interface UseActiveTargetLanguageResult {
  targetLanguage: string | null;
  displayLanguage: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useActiveTargetLanguage(): UseActiveTargetLanguageResult {
  const [language, setLanguage] = useState<UserLanguage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getUserLanguages()
      .then((languages) => {
        if (!active) return;
        const activeLang = languages.find((l) => l.is_active) ?? languages[0] ?? null;
        setLanguage(activeLang);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load language pair');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tick]);

  return {
    targetLanguage: language?.target_language ?? null,
    displayLanguage: language?.display_language ?? null,
    loading,
    error,
    refresh,
  };
}
