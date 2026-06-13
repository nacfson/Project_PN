import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ApiError } from '../api/client';
import { login, loginWithGoogle, register, requestMagicLink } from '../api/auth';
import { AUTH_CALLBACK_PATH, AUTH_CALLBACK_SCHEME } from '../utils/authCallback';
import { isTauri } from '../utils/platform';

WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

  const useCustomRedirect = Platform.OS !== 'web' || isTauri();
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: AUTH_CALLBACK_SCHEME,
    path: AUTH_CALLBACK_PATH,
  });

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
    ...(useCustomRedirect ? { redirectUri } : {}),
  });

  const hasGoogleClient =
    Platform.OS === 'ios'
      ? iosClientId.length > 0
      : Platform.OS === 'android'
        ? androidClientId.length > 0
        : webClientId.length > 0;

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken =
      googleResponse.params.id_token ??
      googleResponse.authentication?.idToken ??
      null;

    if (!idToken) {
      setError('Google sign-in did not return an ID token.');
      return;
    }

    setBusy(true);
    setError(null);
    loginWithGoogle(idToken)
      .then(() => onAuthenticated())
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Google sign-in failed');
      })
      .finally(() => setBusy(false));
  }, [googleResponse, onAuthenticated]);

  const trimmedEmail = email.trim();

  const submitPassword = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(trimmedEmail, password);
      } else {
        await login(trimmedEmail, password);
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    if (trimmedEmail.length === 0) {
      setError('Enter your email first');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestMagicLink(trimmedEmail);
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send magic link');
    } finally {
      setBusy(false);
    }
  };

  if (magicSent) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.hint}>
          If an account exists for {trimmedEmail}, we sent a sign-in link. Open it on this device to
          continue.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setMagicSent(false);
            setError(null);
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryLabel}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const googleDisabled = busy || !googleRequest || !hasGoogleClient;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
        <Text style={styles.subtitle}>Project PN vocabulary capture</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Password'}
          style={styles.input}
          onSubmitEditing={() => void submitPassword()}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          onPress={() => void submitPassword()}
          disabled={busy || trimmedEmail.length === 0 || password.length === 0}
          style={[
            styles.primaryButton,
            (busy || trimmedEmail.length === 0 || password.length === 0) && styles.buttonDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryLabel}>{mode === 'login' ? 'Sign in' : 'Register'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          style={styles.linkButton}
        >
          <Text style={styles.linkLabel}>
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          onPress={() => void sendMagicLink()}
          disabled={busy || trimmedEmail.length === 0}
          style={[styles.secondaryButton, (busy || trimmedEmail.length === 0) && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryLabel}>Email me a sign-in link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setError(null);
            void promptGoogleAsync();
          }}
          disabled={googleDisabled}
          style={[styles.googleButton, googleDisabled && styles.buttonDisabled]}
        >
          <Text style={styles.googleLabel}>Continue with Google</Text>
        </TouchableOpacity>

        {!hasGoogleClient ? (
          <Text style={styles.platformHint}>
            {Platform.OS === 'ios'
              ? 'Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in frontend/.env'
              : Platform.OS === 'android'
                ? 'Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in frontend/.env'
                : 'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in frontend/.env'}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  error: {
    marginTop: 12,
    color: '#dc2626',
    fontSize: 14,
  },
  hint: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#1e293b',
    fontWeight: '600',
    fontSize: 15,
  },
  googleButton: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  googleLabel: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 15,
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkLabel: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  dividerText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  platformHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
