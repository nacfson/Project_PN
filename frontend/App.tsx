import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { me } from './src/api/auth';
import { onboardingStorage } from './src/api/storage';
import { sessionStorage } from './src/api/sessionStorage';
import { AddQueueProvider } from './src/hooks/useAddQueue';
import { useSessionRenewal } from './src/hooks/useSessionRenewal';
import { AppLanguageProvider } from './src/i18n';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { LinkAccountBanner } from './src/features/auth/LinkAccountBanner';
import { RootNavigator } from './src/navigation/RootNavigator';
import { CentralAuthScreen } from './src/screens/CentralAuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { extractSessionFromUrl, parseSessionFromLaunchUrl } from './src/utils/authLaunch';
import { isExtensionLoginFlow, sendSessionToExtension } from './src/utils/extensionAuth';
import { isBrowserWeb } from './src/utils/platform';
import { onUnauthorized } from './src/api/client';
import { analytics } from './src/analytics/analytics';

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
  useSessionRenewal(true);

  return (
    <LanguageProvider>
      <AddQueueProvider>
        <LinkAccountBanner />
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
    analytics.track('session_started', { entry: 'app_launch' });
    return () => { void analytics.flush(); };
  }, []);
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

  const notifyExtensionIfNeeded = useCallback(async () => {
    if (!isBrowserWeb() || !isExtensionLoginFlow()) {
      return;
    }
    const token = await sessionStorage.getToken();
    if (!token) {
      return;
    }
    sendSessionToExtension({
      token,
      refresh_token: (await sessionStorage.getRefreshToken()) ?? token,
      expires_at: (await sessionStorage.getExpiresAt()) ?? new Date(Date.now() + 3600_000).toISOString(),
    });
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
      analytics.track('auth_succeeded', { method: isBrowserWeb() ? 'cookie' : 'bearer' });
      setConnectionError(null);
      await notifyExtensionIfNeeded();
    } catch (err: any) {
      if (err && err.status === 401) {
        if (!isBrowserWeb()) {
          await sessionStorage.clearSession();
        }
        setAuthState('unauthenticated');
        setConnectionError(null);
        analytics.track('auth_failed', { error_code: 'AUTH-101', retryable: false });
      } else {
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
  }, [notifyExtensionIfNeeded]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (!isBrowserWeb()) {
          const incomingSession = await parseSessionFromLaunchUrl();
          if (incomingSession) {
            await sessionStorage.setSession(incomingSession);
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
      const session = extractSessionFromUrl(event.url);
      if (session) {
        await sessionStorage.setSession(session);
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
        await sessionStorage.clearSession();
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
