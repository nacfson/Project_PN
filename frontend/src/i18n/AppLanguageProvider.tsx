import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDeviceLanguageCode } from '../utils/locale';
import { appLanguageStorage } from '../api/storage';
import { en, ko, type TranslationKey } from './translations';

export type AppLanguage = 'en' | 'ko';

type TranslationParams = Record<string, string | number>;

interface AppLanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

const dictionaries: Record<AppLanguage, Record<TranslationKey, string>> = { en, ko };

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'en' || value === 'ko';
}

function defaultLanguage(): AppLanguage {
  return getDeviceLanguageCode() === 'ko' ? 'ko' : 'en';
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(defaultLanguage);

  useEffect(() => {
    let active = true;
    appLanguageStorage.getLanguage().then((stored) => {
      if (!active) {
        return;
      }
      setLanguageState(stored === null ? defaultLanguage() : isAppLanguage(stored) ? stored : 'en');
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    await appLanguageStorage.setLanguage(nextLanguage);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      const dictionary = dictionaries[language];
      return interpolate(dictionary[key] ?? en[key], params);
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage(): AppLanguageContextValue {
  const value = useContext(AppLanguageContext);
  if (!value) {
    throw new Error('useAppLanguage must be used within AppLanguageProvider');
  }
  return value;
}
