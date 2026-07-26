import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { themeModeStorage, themeVariationStorage } from '../api/storage';
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

export type ThemeVariation = 'bentoIndigo' | 'bentoSunset' | 'bentoLight';
type DarkThemeVariation = 'bentoIndigo' | 'bentoSunset';

const variationModes: Record<ThemeVariation, ThemeMode> = {
  bentoLight: 'light',
  bentoIndigo: 'dark',
  bentoSunset: 'dark',
};

function isThemeVariation(value: string | null): value is ThemeVariation {
  return value === 'bentoIndigo' || value === 'bentoSunset' || value === 'bentoLight';
}

function isDarkVariation(value: ThemeVariation): value is DarkThemeVariation {
  return value === 'bentoIndigo' || value === 'bentoSunset';
}

function getColorsForTheme(variation: ThemeVariation) {
  const targetMode = variationModes[variation];
  const base = colorsFor(targetMode);
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

  const merged = {
    ...base,
    ...overrides,
  };

  // Re-propagate overrides to legacy text and border color aliases
  merged.text = merged.onSurface;
  merged.textMuted = merged.onSurfaceVariant;
  merged.textInverse = merged.inverseOnSurface;
  merged.border = merged.outlineVariant;

  return merged;
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
  const [variation, setVariationState] = useState<ThemeVariation>('bentoIndigo');
  const variationRef = useRef(variation);
  variationRef.current = variation;
  const lastDarkVariationRef = useRef<DarkThemeVariation>('bentoIndigo');
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
    Promise.all([themeModeStorage.getMode(), themeVariationStorage.getVariation()]).then(
      ([storedMode, storedVariation]) => {
        if (!active) return;

        // Prefer stored variation. If only mode is stored, map it to a variation.
        // Otherwise keep the product default (bentoIndigo) — variation drives painted colors.
        let nextVariation: ThemeVariation = 'bentoIndigo';
        if (isThemeVariation(storedVariation)) {
          nextVariation = storedVariation;
        } else if (storedMode === 'light') {
          nextVariation = 'bentoLight';
        } else if (storedMode === 'dark') {
          nextVariation = 'bentoIndigo';
        }

        const effectiveMode = variationModes[nextVariation];
        if (isDarkVariation(nextVariation)) {
          lastDarkVariationRef.current = nextVariation;
        }
        setVariationState(nextVariation);

        // Prefer variation as source of painted colors; rewrite mode if they disagree.
        if (storedMode !== effectiveMode) {
          void themeModeStorage.setMode(effectiveMode);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const setVariation = useCallback((nextVar: ThemeVariation) => {
    const nextMode = variationModes[nextVar];
    if (isDarkVariation(nextVar)) {
      lastDarkVariationRef.current = nextVar;
    }
    setVariationState(nextVar);
    void themeVariationStorage.setVariation(nextVar);
    void themeModeStorage.setMode(nextMode);
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    const current = variationRef.current;
    const nextVariation: ThemeVariation =
      nextMode === 'light'
        ? 'bentoLight'
        : isDarkVariation(current)
          ? current
          : lastDarkVariationRef.current;
    if (isDarkVariation(nextVariation)) {
      lastDarkVariationRef.current = nextVariation;
    }
    setVariationState(nextVariation);
    void themeVariationStorage.setVariation(nextVariation);
    void themeModeStorage.setMode(nextMode);
  }, []);

  const toggleMode = useCallback(() => {
    const currentMode = variationModes[variationRef.current];
    setMode(currentMode === 'dark' ? 'light' : 'dark');
  }, [setMode]);

  const value = useMemo(() => {
    const effectiveMode = variationModes[variation];
    const baseTheme = themeFor(effectiveMode);
    const customizedColors = getColorsForTheme(variation);
    return {
      ...baseTheme,
      mode: effectiveMode,
      colors: customizedColors,
      setMode,
      toggleMode,
      motion,
      reduced,
      variation,
      setVariation,
    };
  }, [setMode, toggleMode, reduced, variation, setVariation]);

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
