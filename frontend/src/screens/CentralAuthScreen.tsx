import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '../config';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Text } from '../ui';
import { sessionStorage } from '../api/sessionStorage';
import { extractSessionFromUrl } from '../utils/authLaunch';
import { isBrowserWeb } from '../utils/platform';
import { analytics } from '../analytics/analytics';

interface CentralAuthScreenProps {
  onTokenReceived?: () => void;
  connectionError?: string | null;
}

export function CentralAuthScreen({ onTokenReceived, connectionError }: CentralAuthScreenProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    const traceId = analytics.track('auth_started', { provider: 'platform' });
    try {
      const browserWeb = isBrowserWeb();
      if (browserWeb) {
        // Defer to Traefik ForwardAuth: navigating to origin triggers platform login / Keycloak broker
        window.location.href = window.location.origin;
      } else {
        const redirectUrl = 'projectpn://auth';
        const authUrl = `${API_BASE_URL}/`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (result.type === 'success') {
          const session = extractSessionFromUrl(result.url);
          if (session) {
            await sessionStorage.setSession(session);
            if (onTokenReceived) {
              onTokenReceived();
            }
            analytics.track('auth_succeeded', { provider: 'platform' }, traceId);
          }
        }
      }
    } catch (err) {
      analytics.track('auth_failed', { provider: 'platform', error_code: 'AUTH-101', retryable: true }, traceId);
      console.error('Failed to open login page', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card elevated style={styles.card}>
        <View style={styles.header}>
          <Icon name="lock-closed" size="lg" color={colors.primary} />
          <Text variant="heading" style={{ marginTop: spacing.sm }}>
            {t('auth.centralTitle')}
          </Text>
          <Text color="muted" style={{ textAlign: 'center' }}>
            {t('auth.centralTagline')}
          </Text>
        </View>

        {connectionError && (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder }]}>
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

        <Text variant="body" color="muted" style={[styles.desc, { marginVertical: spacing.md }]}>
          {t('auth.centralDescription')}
        </Text>
        <Button
          label={t('auth.centralSignIn')}
          loading={busy}
          onPress={handleSignIn}
          style={{ width: '100%' }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, alignItems: 'center', padding: 24 },
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
