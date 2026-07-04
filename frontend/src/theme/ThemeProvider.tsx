import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { themeModeStorage } from '../api/storage';
import { themeFor, colorsFor, visualVariations, type Theme, type ThemeMode } from './tokens';
import * as motion from './motion';
import { useReducedMotion } from './motion';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

export type ThemeVariation = 'bentoIndigo' | 'bentoSunset' | 'bentoLight' | 'cyberpunk' | 'minimalist' | 'brutalist';

function getColorsForTheme(mode: ThemeMode, variation: ThemeVariation) {
  const base = colorsFor(mode);
  const varOverrides = visualVariations[variation];
  
  if (!varOverrides) return base;

  const overrides: Partial<typeof base> = {};

  if ('background' in varOverrides) overrides.background = varOverrides.background;
  if ('surface' in varOverrides) {
    overrides.surface = varOverrides.surface;
    overrides.surfaceGlass = varOverrides.surface;
    overrides.surfaceContainer = varOverrides.surface;
    overrides.surfaceContainerLow = varOverrides.surface;
    overrides.surfaceContainerHigh = varOverrides.surface;
    overrides.surfaceContainerLowest = varOverrides.surface;
    overrides.surfaceContainerHighest = varOverrides.surface;
  }
  if ('border' in varOverrides) {
    overrides.outlineVariant = varOverrides.border;
    overrides.borderGlass = varOverrides.border;
    overrides.border = varOverrides.border;
  }

  if ('accentPink' in varOverrides) {
    overrides.accent = varOverrides.accentPink;
    overrides.tertiary = varOverrides.accentPink;
  } else if ('accentOrange' in varOverrides) {
    overrides.accent = varOverrides.accentOrange;
    overrides.tertiary = varOverrides.accentOrange;
  } else if ('accentGlow' in varOverrides) {
    overrides.accent = '#00ffcc';
  }

  return {
    ...base,
    ...overrides,
  };
}

interface ThemeContextValue extends Theme {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  motion: typeof motion;
  reduced: boolean;
  variation: ThemeVariation;
  setVariation: (variation: ThemeVariation) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(() =>
    systemColorScheme === 'dark' ? 'dark' : 'light',
  );
  const [variation, setVariation] = useState<ThemeVariation>('bentoIndigo');
  const reduced = useReducedMotion();
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  });

  useEffect(() => {
    let active = true;
    themeModeStorage.getMode().then((stored) => {
      if (!active) return;
      if (stored) {
        setModeState(stored);
      } else if (systemColorScheme === 'dark' || systemColorScheme === 'light') {
        setModeState(systemColorScheme);
      }
    });
    return () => {
      active = false;
    };
  }, [systemColorScheme]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void themeModeStorage.setMode(nextMode);
  }, []);

  const toggleMode = useCallback(() => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [mode, setMode]);

  const value = useMemo(() => {
    const baseTheme = themeFor(mode);
    const customizedColors = getColorsForTheme(mode, variation);
    return {
      ...baseTheme,
      colors: customizedColors,
      setMode,
      toggleMode,
      motion,
      reduced,
      variation,
      setVariation,
    };
  }, [mode, setMode, toggleMode, reduced, variation]);

  if (!fontsLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
