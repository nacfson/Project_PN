import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { me, logout } from './src/api/auth';
import { sessionStorage } from './src/api/storage';
import { AuthCallbackHandler } from './src/components/AuthCallbackHandler';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ManualAddScreen } from './src/screens/ManualAddScreen';

type Tab = 'capture' | 'manual';
type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function MainApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('capture');

  const handleLogout = () => {
    void (async () => {
      await logout();
      onLogout();
    })();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>Project PN</Text>
            <Text style={styles.subtitle}>Add words you do not know</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutLabel}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setTab('capture')}
          style={[styles.tab, tab === 'capture' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'capture' && styles.tabLabelActive]}>Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('manual')}
          style={[styles.tab, tab === 'manual' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'manual' && styles.tabLabelActive]}>Manual Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {tab === 'capture' ? <CaptureScreen /> : <ManualAddScreen />}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [callbackError, setCallbackError] = useState<string | null>(null);

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
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1e293b" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <AuthCallbackHandler onAuthenticated={onAuthenticated} onError={setCallbackError} />
      {authState === 'authenticated' ? (
        <MainApp onLogout={() => setAuthState('unauthenticated')} />
      ) : (
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          {callbackError ? <Text style={styles.callbackError}>{callbackError}</Text> : null}
          <LoginScreen onAuthenticated={onAuthenticated} />
        </SafeAreaView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  logoutLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  tabActive: {
    backgroundColor: '#1e293b',
  },
  tabLabel: {
    fontWeight: '600',
    color: '#475569',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  body: {
    flex: 1,
  },
  callbackError: {
    marginHorizontal: 20,
    marginTop: 12,
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
});
