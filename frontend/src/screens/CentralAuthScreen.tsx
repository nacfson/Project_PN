import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { analytics } from '../analytics/analytics';
import { sessionStorage } from '../api/sessionStorage';
import { API_BASE_URL } from '../config';
import { AuthLoadingCard } from '../features/auth/AuthLoadingCard';
import { useAppLanguage } from '../i18n';
import { spacing, useTheme } from '../theme';
import { Button, Card, Icon, Text } from '../ui';
import { extractSessionFromUrl } from '../utils/authLaunch';
import { isBrowserWeb } from '../utils/platform';

type AuthPhase = 'idle' | 'redirecting' | 'verifying';

interface CentralAuthScreenProps {
  onTokenReceived?: () => void | Promise<void>;
  connectionError?: string | null;
}

export function CentralAuthScreen({ onTokenReceived, connectionError }: CentralAuthScreenProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const [phase, setPhase] = useState<AuthPhase>('idle');
  const handleCancel = useCallback(() => {
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (!isBrowserWeb() || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    const handlePageShow = (event: { persisted?: boolean }) => {
      if (event.persisted) {
        setPhase('idle');
      }
    };

    window.addEventListener('pageshow', handlePageShow as EventListener);
    return () => {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('pageshow', handlePageShow as EventListener);
      }
    };
  }, []);

  const handleSignIn = async () => {
    setPhase('redirecting');
    const traceId = analytics.track('auth_started', { provider: 'platform' });
    try {
      const browserWeb = isBrowserWeb();
      if (browserWeb) {
        window.location.href = `${API_BASE_URL}/api/auth/login`;
        // Keep loading UI visible while the browser navigates to the login endpoint.
        return;
      }

      const redirectUrl = 'projectpn://auth';
      const authUrl = `${API_BASE_URL}/`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success') {
        const session = extractSessionFromUrl(result.url);
        if (session) {
          setPhase('verifying');
          await sessionStorage.setSession(session);
          analytics.track('auth_succeeded', { provider: 'platform' }, traceId);
          if (onTokenReceived) {
            await onTokenReceived();
          }
          setPhase('idle');
          return;
        }
      }
      setPhase('idle');
    } catch (err) {
      analytics.track(
        'auth_failed',
        { provider: 'platform', error_code: 'AUTH-101', retryable: true },
        traceId,
      );
      console.error('Failed to open login page', err);
      setPhase('idle');
    }
  };

  if (phase !== 'idle') {
    const loadingTitle =
      phase === 'verifying' ? t('auth.loadingVerifyTitle') : t('auth.loadingRedirectTitle');
    return (
      <View style={[styles.container, { backgroundColor: colors.canvas }]}>
        <AuthLoadingCard title={loadingTitle} onCancel={handleCancel} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Card elevated style={styles.card}>
        <View style={styles.header}>
          <Icon name="lock-closed" size="lg" color={colors.accent} />
          <Text variant="pageTitle" style={{ marginTop: spacing.sm }}>
            {t('auth.centralTitle')}
          </Text>
          <Text color={colors.textSecondary} style={{ textAlign: 'center' }}>
            {t('auth.centralTagline')}
          </Text>
        </View>

        {connectionError && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
            ]}
          >
            <Icon name="alert-circle-outline" size="md" color={colors.danger} />
            <View style={styles.errorContent}>
              <Text style={[styles.errorTitle, { color: colors.danger }]}>
                {t('auth.connectionFailed')}
              </Text>
              {__DEV__ && (
                <Text style={[styles.errorDetail, { color: colors.textMuted }]}>
                  {connectionError}
                </Text>
              )}
            </View>
          </View>
        )}

        <Text
          variant="body"
          color={colors.textSecondary}
          style={[styles.desc, { marginVertical: spacing.md }]}
        >
          {t('auth.centralDescription')}
        </Text>
        <Button
          label={t('auth.centralSignIn')}
          onPress={() => {
            void handleSignIn();
          }}
          style={{ width: '100%' }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, minHeight: 236, alignItems: 'center', padding: 24 },
  header: { alignItems: 'center', gap: 8 },
  desc: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
    width: '100%',
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
});
