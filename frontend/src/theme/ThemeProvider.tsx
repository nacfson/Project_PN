import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { clearLegacyThemePreferences } from '../api/storage';
import { theme, type Theme } from './tokens';
import { fontAssets } from './fonts';
import * as motion from './motion';
import { useReducedMotion } from './motion';

export interface ThemeContextValue extends Theme {
  motion: typeof motion;
  reduced: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [fontsLoaded] = useFonts(fontAssets);

  useEffect(() => {
    if (typeof clearLegacyThemePreferences === 'function') {
      void clearLegacyThemePreferences();
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const id = 'kidlearn-google-fonts';
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=Roboto+Mono:wght@400;500&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...theme,
      colors: theme.colors,
      motion,
      reduced,
    }),
    [reduced],
  );

  if (Platform.OS !== 'web' && !fontsLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
