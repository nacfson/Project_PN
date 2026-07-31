import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { me } from './src/api/auth';
import { onboardingStorage } from './src/api/storage';
import { sessionStorage } from './src/api/sessionStorage';
import { AddQueueProvider } from './src/hooks/useAddQueue';
import { AppLanguageProvider } from './src/i18n';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { CentralAuthScreen } from './src/screens/CentralAuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { parseTokenFromLaunchUrl, extractTokenFromUrl } from './src/utils/authLaunch';
import { isBrowserWeb } from './src/utils/platform';
import { onUnauthorized } from './src/api/client';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  return (
    <LanguageProvider>
      <AddQueueProvider>
        <RootNavigator onLogout={onLogout} />
      </AddQueueProvider>
    </LanguageProvider>
  );
}

function AppContent() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { colors, mode } = useTheme();

  const authStateRef = useRef<AuthState>('loading');
  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  useEffect(() => {
    let active = true;
    onboardingStorage.getCompleted().then((completed) => {
      if (!active) return;
      setOnboardingCompleted(completed);
    }).catch(() => {
      if (active) setOnboardingCompleted(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      if (!isBrowserWeb()) {
        const token = await sessionStorage.getToken();
        if (!token) {
          setAuthState('unauthenticated');
          setConnectionError(null);
          return;
        }
      }
      await me();
      setAuthState('authenticated');
      setConnectionError(null);
    } catch (err: any) {
      if (err && err.status === 401) {
        if (!isBrowserWeb()) {
          await sessionStorage.removeToken();
        }
        setAuthState('unauthenticated');
        setConnectionError(null);
      } else {
        // Keep the token saved.
        const current = authStateRef.current;
        if (current === 'unauthenticated') {
          setConnectionError(err.message || 'Could not connect to the backend server.');
          setAuthState('unauthenticated');
        } else {
          setAuthState('authenticated');
          setConnectionError(null);
        }
      }
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (!isBrowserWeb()) {
          const incomingToken = await parseTokenFromLaunchUrl();
          if (incomingToken) {
            await sessionStorage.setToken(incomingToken);
          }
        }
        await checkAuth();
      } catch {
        setAuthState('unauthenticated');
      }
    };
    void initializeAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleOpenURL = async (event: { url: string }) => {
      if (isBrowserWeb()) return;
      const token = extractTokenFromUrl(event.url);
      if (token) {
        await sessionStorage.setToken(token);
        void checkAuth();
      }
    };
    const subscription = Linking.addEventListener('url', handleOpenURL);
    return () => {
      subscription.remove();
    };
  }, [checkAuth]);

  useEffect(() => {
    const unsubscribe = onUnauthorized(async () => {
      if (!isBrowserWeb()) {
        await sessionStorage.removeToken();
      }
      setAuthState('unauthenticated');
    });
    return unsubscribe;
  }, []);

  const completeOnboarding = useCallback(() => {
    void onboardingStorage.setCompleted(true);
    setOnboardingCompleted(true);
  }, []);

  if (authState === 'loading' || onboardingCompleted === null) {
    return <LoadingScreen />;
  }

  if (!onboardingCompleted) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OnboardingScreen onComplete={completeOnboarding} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {authState === 'authenticated' ? (
        <AuthenticatedApp onLogout={() => setAuthState('unauthenticated')} />
      ) : (
        <SafeAreaView
          edges={['top', 'right', 'bottom', 'left']}
          style={[styles.safe, { backgroundColor: colors.background }]}
        >
          <CentralAuthScreen 
            onTokenReceived={checkAuth} 
            connectionError={connectionError}
          />
        </SafeAreaView>
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppLanguageProvider>
          <AppContent />
        </AppLanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
