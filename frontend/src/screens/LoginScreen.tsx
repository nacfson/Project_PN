import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ApiError } from '../api/client';
import { getLanguageOptions, login, loginWithGoogle, register, requestMagicLink } from '../api/auth';
import type { LanguageOptionsResponse } from '../types/auth';
import { SUPPORTED_LANGUAGES } from '../config';
import { getDeviceLanguageCode } from '../utils/locale';
import { AUTH_CALLBACK_PATH, AUTH_CALLBACK_SCHEME } from '../utils/authCallback';
import { isTauri } from '../utils/platform';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Input, Text } from '../ui';

WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onAuthenticated: () => void;
}

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

const hasGoogleClient =
  Platform.OS === 'ios'
    ? iosClientId.length > 0
    : Platform.OS === 'android'
      ? androidClientId.length > 0
      : webClientId.length > 0;

interface GoogleSignInButtonProps {
  busy: boolean;
  onError: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
  onAuthenticated: () => void;
}

function GoogleSignInButton({ busy, onError, onBusyChange, onAuthenticated }: GoogleSignInButtonProps) {
  const { t } = useAppLanguage();
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

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken =
      googleResponse.params.id_token ?? googleResponse.authentication?.idToken ?? null;

    if (!idToken) {
      onError(t('auth.googleNoToken'));
      return;
    }

    onBusyChange(true);
    onError('');
    loginWithGoogle(idToken)
      .then(() => onAuthenticated())
      .catch((err: unknown) => {
        onError(err instanceof ApiError ? err.message : t('auth.googleFailed'));
      })
      .finally(() => onBusyChange(false));
  }, [googleResponse, onAuthenticated, onBusyChange, onError]);

  const googleDisabled = busy || !googleRequest;

  return (
    <Button
      label={t('auth.google')}
      variant="secondary"
      iconLeft="logo-google"
      onPress={() => {
        onError('');
        void promptGoogleAsync();
      }}
      disabled={googleDisabled}
    />
  );
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const [langOptions, setLangOptions] = useState<LanguageOptionsResponse | null>(null);
  const [targetLang, setTargetLang] = useState<string>('');
  const [nativeLang, setNativeLang] = useState<string>('');

  const trimmedEmail = email.trim();

  useEffect(() => {
    let cancelled = false;
    getLanguageOptions()
      .then((options) => {
        if (cancelled) return;
        setLangOptions(options);
        const deviceLang = getDeviceLanguageCode();

        const nextTarget = options.forced.target_language || options.defaults.target_language;
        setTargetLang(nextTarget);

        let nextNative = options.defaults.definition_language;
        if (options.forced.definition_language) {
          nextNative = options.forced.definition_language;
        } else if (
          deviceLang &&
          (options.allowed.definition_languages.length === 0 ||
            options.allowed.definition_languages.includes(deviceLang))
        ) {
          nextNative = deviceLang;
        }
        setNativeLang(nextNative);
      })
      .catch(() => {
        // The endpoint is public; if it fails, the form will fall back to backend defaults on submit.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitPassword = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(trimmedEmail, password, {
          targetLanguage: targetLang,
          nativeLanguage: nativeLang,
        });
      } else {
        await login(trimmedEmail, password);
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    if (trimmedEmail.length === 0) {
      setError(t('auth.enterEmailFirst'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestMagicLink(trimmedEmail);
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.magicLinkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const isForcedTarget = !!langOptions?.forced.target_language;
  const isForcedNative = !!langOptions?.forced.definition_language;

  const targetOptions = (() => {
    if (!langOptions) return SUPPORTED_LANGUAGES;
    const allowed = langOptions.allowed.target_languages;
    return allowed.length > 0
      ? SUPPORTED_LANGUAGES.filter((l) => allowed.includes(l.code))
      : SUPPORTED_LANGUAGES;
  })();

  const nativeOptions = (() => {
    if (!langOptions) return SUPPORTED_LANGUAGES;
    const allowed = langOptions.allowed.definition_languages;
    return allowed.length > 0
      ? SUPPORTED_LANGUAGES.filter((l) => allowed.includes(l.code))
      : SUPPORTED_LANGUAGES;
  })();

  const renderLanguageRow = ({
    label,
    value,
    options,
    onChange,
    forced,
  }: {
    label: string;
    value: string;
    options: { code: string; name: string }[];
    onChange: (code: string) => void;
    forced: boolean;
  }) => {
    const selected = options.find((l) => l.code === value);
    if (forced) {
      return (
        <View style={{ marginTop: spacing.md }}>
          <Text variant="label" color="muted">
            {label}
          </Text>
          <View style={[styles.lockedRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <Text variant="body" bold>
              {selected ? `${selected.name} (${selected.code})` : value}
            </Text>
            <View style={[styles.lockedBadge, { backgroundColor: colors.border }]}>
              <Text variant="caption">{t('auth.lockedByAdmin')}</Text>
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={{ marginTop: spacing.md }}>
        <Text variant="label" color="muted">
          {label}
        </Text>
        <View style={styles.pickerWrapper}>
          {options.map((lang) => (
            <Button
              key={lang.code}
              label={lang.name}
              variant={value === lang.code ? 'primary' : 'secondary'}
              onPress={() => onChange(lang.code)}
              style={styles.pickerChip}
            />
          ))}
        </View>
      </View>
    );
  };

  if (magicSent) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.successSurface }]}>
          <Icon name="mail" size="xl" color={colors.success} />
        </View>
        <Text variant="heading" style={{ marginTop: spacing.lg }}>
          {t('auth.checkEmailTitle')}
        </Text>
        <Text color="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {t('auth.checkEmailMessage', { email: trimmedEmail })}
        </Text>
        <Button
          label={t('auth.backToSignIn')}
          variant="ghost"
          onPress={() => {
            setMagicSent(false);
            setError(null);
          }}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card elevated style={styles.card}>
          <View style={[styles.header, { gap: spacing.xs }]}>
            <Text variant="heading">{mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}</Text>
            <Text color="muted">{t('auth.subtitle')}</Text>
          </View>

          <View style={[styles.segmentedControl, { backgroundColor: colors.surfaceAlt, borderRadius: 999 }]}>
            <Button
              label={t('auth.signIn')}
              variant={mode === 'login' ? 'primary' : 'ghost'}
              onPress={() => {
                setMode('login');
                setError(null);
              }}
              style={styles.segmentButton}
            />
            <Button
              label={t('auth.createAccount')}
              variant={mode === 'register' ? 'primary' : 'ghost'}
              onPress={() => {
                setMode('register');
                setError(null);
              }}
              style={styles.segmentButton}
            />
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Text variant="label" color="muted">
              {t('auth.email')}
            </Text>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={t('auth.emailPlaceholder')}
              onSubmitEditing={() => void submitPassword()}
              returnKeyType="next"
            />

            <Text variant="label" color="muted">
              {t('auth.password')}
            </Text>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={mode === 'register' ? t('auth.passwordCreatePlaceholder') : t('auth.passwordPlaceholder')}
              onSubmitEditing={() => void submitPassword()}
              returnKeyType="go"
            />
            {mode === 'register' && (
              <Text variant="caption" color="muted">
                {t('auth.passwordHelp')}
              </Text>
            )}
          </View>

          {mode === 'register' && (
            <>
              {renderLanguageRow({
                label: t('auth.targetLanguage'),
                value: targetLang,
                options: targetOptions,
                onChange: setTargetLang,
                forced: isForcedTarget,
              })}
              {renderLanguageRow({
                label: t('auth.nativeLanguage'),
                value: nativeLang,
                options: nativeOptions,
                onChange: setNativeLang,
                forced: isForcedNative,
              })}
            </>
          )}

          {error ? (
            <View style={[styles.errorRow, { backgroundColor: colors.dangerSurface }]}>
              <Icon name="alert-circle" size="sm" color={colors.danger} />
              <Text variant="body" color="danger">
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            label={mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            loading={busy}
            disabled={trimmedEmail.length === 0 || password.length === 0}
            onPress={() => void submitPassword()}
            style={{ marginTop: spacing.lg }}
          />

          <View style={[styles.dividerRow, { marginVertical: spacing.xl }]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text variant="caption" color="muted">
              {t('auth.or')}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={{ gap: spacing.md }}>
            <Button
              label={t('auth.magicLink')}
              variant="secondary"
              iconLeft="mail"
              onPress={() => void sendMagicLink()}
              disabled={busy || trimmedEmail.length === 0}
            />

            {hasGoogleClient ? (
              <GoogleSignInButton
                busy={busy}
                onError={setError}
                onBusyChange={setBusy}
                onAuthenticated={onAuthenticated}
              />
            ) : (
              <Text variant="caption" color="muted" style={{ textAlign: 'center' }}>
                {Platform.OS === 'ios'
                  ? t('auth.googleIosMissing')
                  : Platform.OS === 'android'
                    ? t('auth.googleAndroidMissing')
                    : t('auth.googleWebMissing')}
              </Text>
            )}
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 32,
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  pickerWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pickerChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  lockedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
