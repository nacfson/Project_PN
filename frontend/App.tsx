import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { me } from './src/api/auth';
import { sessionStorage } from './src/api/storage';
import { AuthCallbackHandler } from './src/components/AuthCallbackHandler';
import { AddQueueProvider } from './src/hooks/useAddQueue';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
}

function AppContent() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const { colors } = useTheme();

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

  const onAuthenticated = useCallback(() => {
    setCallbackError(null);
    setAuthState('authenticated');
  }, []);

  if (authState === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <>
      <AuthCallbackHandler onAuthenticated={onAuthenticated} onError={setCallbackError} />
      {authState === 'authenticated' ? (
        <AddQueueProvider>
          <RootNavigator onLogout={() => setAuthState('unauthenticated')} />
        </AddQueueProvider>
      ) : (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.surfaceAlt }]}>
          <StatusBar style="dark" />
          {callbackError ? (
            <Text style={[styles.callbackError, { color: colors.danger }]}>{callbackError}</Text>
          ) : null}
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
        <AppContent />
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
  callbackError: {
    marginHorizontal: 20,
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
});
