import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { getLanguageOptions, login, register, requestVerificationEmail } from '../api/auth';
import type { LanguageOptionsResponse } from '../types/auth';
import { IS_CENTRAL_AUTH, SUPPORTED_LANGUAGES } from '../config';
import { getDeviceLanguageCode } from '../utils/locale';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Input, Text } from '../ui';

interface LoginScreenProps {
  verifiedEmail?: string | null;
  onAuthenticated: () => void;
}

export function LoginScreen({ verifiedEmail, onAuthenticated }: LoginScreenProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(verifiedEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);

  const [langOptions, setLangOptions] = useState<LanguageOptionsResponse | null>(null);
  const [targetLang, setTargetLang] = useState<string>('');
  const [nativeLang, setNativeLang] = useState<string>('');

  const trimmedEmail = email.trim();
  const [emailTouched, setEmailTouched] = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const emailError = emailTouched && trimmedEmail.length > 0 && !isValidEmail(trimmedEmail);

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
      if (!IS_CENTRAL_AUTH && mode === 'register') {
        await register(trimmedEmail, password, {
          targetLanguage: targetLang,
          nativeLanguage: nativeLang,
        });
        setVerificationPending(true);
      } else {
        await login(trimmedEmail, password);
        onAuthenticated();
      }
    } catch (err) {
      if (!IS_CENTRAL_AUTH && err instanceof ApiError && err.status === 403) {
        setVerificationPending(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : t('auth.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (trimmedEmail.length === 0) {
      setError(t('auth.enterEmailFirst'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestVerificationEmail(trimmedEmail);
      setVerificationPending(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.verificationFailed'));
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
          <View style={[styles.lockedRow, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}>
            <Text variant="body" bold>
              {selected ? `${selected.name} (${selected.code})` : value}
            </Text>
            <View style={[styles.lockedBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
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
              variant={value === lang.code ? 'primary' : 'tonal'}
              onPress={() => onChange(lang.code)}
              style={styles.pickerChip}
            />
          ))}
        </View>
      </View>
    );
  };

  if (verificationPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.successSurface }]}>
          <Icon name="mail" size="xl" color={colors.success} />
        </View>
        <Text variant="heading" style={{ marginTop: spacing.lg }}>
          {t('auth.verifyEmailTitle')}
        </Text>
        <Text color="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {t('auth.verifyEmailMessage', { email: trimmedEmail })}
        </Text>
        <Button
          label={t('auth.resendVerification')}
          variant="tonal"
          iconLeft="mail"
          onPress={() => void resendVerification()}
          disabled={busy}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          label={t('auth.backToSignIn')}
          variant="ghost"
          onPress={() => {
            setVerificationPending(false);
            setError(null);
          }}
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card elevated style={styles.card}>
          <View style={[styles.header, { gap: spacing.xs }]}>
            <Text variant="heading">{IS_CENTRAL_AUTH || mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}</Text>
            <Text color="muted">{t('auth.subtitle')}</Text>
          </View>

          {!IS_CENTRAL_AUTH && (
            <View style={[styles.segmentedControl, { backgroundColor: colors.surfaceContainerHighest, borderRadius: 999 }]}>
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
          )}

          {verifiedEmail ? (
            <View style={[styles.successRow, { backgroundColor: colors.successSurface }]}>
              <Icon name="checkmark-circle" size="sm" color={colors.success} />
              <Text variant="body" color="success">
                {t('auth.emailVerified')}
              </Text>
            </View>
          ) : null}

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
              error={emailError}
              helperText={emailError ? t('auth.emailInvalid') : undefined}
              onBlur={() => setEmailTouched(true)}
            />

            <Text variant="label" color="muted">
              {t('auth.password')}
            </Text>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureTextEntryToggle
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={!IS_CENTRAL_AUTH && mode === 'register' ? t('auth.passwordCreatePlaceholder') : t('auth.passwordPlaceholder')}
              onSubmitEditing={() => void submitPassword()}
              returnKeyType="go"
            />
            {!IS_CENTRAL_AUTH && mode === 'register' && (
              <Text variant="caption" color="muted">
                {t('auth.passwordHelp')}
              </Text>
            )}
          </View>

          {!IS_CENTRAL_AUTH && mode === 'register' && (
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
            <View style={[styles.errorRow, { backgroundColor: colors.errorContainer }]}>
              <Icon name="alert-circle" size="sm" color={colors.error} />
              <Text variant="body" color="danger">
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            label={IS_CENTRAL_AUTH || mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            loading={busy}
            disabled={trimmedEmail.length === 0 || password.length === 0}
            onPress={() => void submitPassword()}
            style={{ marginTop: spacing.lg }}
          />
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
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
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
