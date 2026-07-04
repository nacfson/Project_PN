import { useLanguage } from '../contexts/LanguageContext';

interface UseActiveTargetLanguageResult {
  targetLanguage: string | null;
  displayLanguage: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useActiveTargetLanguage(): UseActiveTargetLanguageResult {
  const { targetLanguage, displayLanguage, loading, error, refresh } = useLanguage();
  return { targetLanguage, displayLanguage, loading, error, refresh };
}
