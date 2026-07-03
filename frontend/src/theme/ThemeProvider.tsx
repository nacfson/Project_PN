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
import { themeFor, type Theme, type ThemeMode } from './tokens';
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

interface ThemeContextValue extends Theme {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  motion: typeof motion;
  reduced: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(() =>
    systemColorScheme === 'dark' ? 'dark' : 'light',
  );
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
    return {
      ...themeFor(mode),
      setMode,
      toggleMode,
      motion,
      reduced,
    };
  }, [mode, setMode, toggleMode, reduced]);

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
