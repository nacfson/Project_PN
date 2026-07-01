import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { me } from './src/api/auth';
import { onboardingStorage, sessionStorage } from './src/api/storage';
import { AddQueueProvider } from './src/hooks/useAddQueue';
import { AppLanguageProvider } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { parseVerifiedEmailFromLaunchUrl } from './src/utils/authLaunch';
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
    <AddQueueProvider>
      <RootNavigator onLogout={onLogout} />
    </AddQueueProvider>
  );
}

function AppContent() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const { colors, mode } = useTheme();

  useEffect(() => {
    let active = true;
    onboardingStorage.getCompleted().then((completed) => {
      if (!active) return;
      setOnboardingCompleted(completed);
    });
    parseVerifiedEmailFromLaunchUrl().then((email: string | null) => {
      if (!active) return;
      if (email) {
        setVerifiedEmail(email);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const checkAuth = useCallback(async () => {
    const token = await sessionStorage.getToken();
    if (!token) {
      setAuthState('unauthenticated');
      return;
    }
    try {
      await me();
      setAuthState('authenticated');
    } catch {
      await sessionStorage.removeToken();
      setAuthState('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const unsubscribe = onUnauthorized(async () => {
      await sessionStorage.removeToken();
      setAuthState('unauthenticated');
    });
    return unsubscribe;
  }, []);

  const onAuthenticated = useCallback(() => {
    setVerifiedEmail(null);
    setAuthState('authenticated');
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
          <LoginScreen onAuthenticated={onAuthenticated} />
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
