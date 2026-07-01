import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { login } from '../api/auth';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Input, Text } from '../ui';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const [emailTouched, setEmailTouched] = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const emailError = emailTouched && trimmedEmail.length > 0 && !isValidEmail(trimmedEmail);

  const submitPassword = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(trimmedEmail, password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card elevated style={styles.card}>
          <View style={[styles.header, { gap: spacing.xs }]}>
            <Text variant="heading">{t('auth.signIn')}</Text>
            <Text color="muted">{t('auth.subtitle')}</Text>
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
              placeholder={t('auth.passwordPlaceholder')}
              onSubmitEditing={() => void submitPassword()}
              returnKeyType="go"
            />
          </View>

          {error ? (
            <View style={[styles.errorRow, { backgroundColor: colors.errorContainer }]}>
              <Icon name="alert-circle" size="sm" color={colors.error} />
              <Text variant="body" color="danger">
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            label={t('auth.signIn')}
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
