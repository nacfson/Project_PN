import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CENTRAL_AUTH_URL } from '../config';
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
  onContinueBrowsing?: () => void;
}

export function getDoorReturnAddress(): string {
  if (typeof window !== 'undefined' && window.location) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const protocol = isLocal ? window.location.protocol : 'https:';
    const path = window.location.pathname || '/';
    const search = window.location.search || '';
    return `${protocol}//${window.location.host}${path}${search}`;
  }
  return 'https://pn.example.com/';
}

export function CentralAuthScreen({ onTokenReceived, connectionError, onContinueBrowsing }: CentralAuthScreenProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    const traceId = analytics.track('auth_started', { provider: 'central_auth' });
    try {
      const browserWeb = isBrowserWeb();
      const returnAddress = getDoorReturnAddress();
      const authUrl = `${CENTRAL_AUTH_URL}/oauth/start?return=${encodeURIComponent(returnAddress)}`;

      if (browserWeb) {
        // Send browser directly to platform start with return query parameter
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, returnAddress);
        if (result.type === 'success') {
          const session = extractSessionFromUrl(result.url);
          if (session) {
            await sessionStorage.setSession(session);
            if (onTokenReceived) {
              onTokenReceived();
            }
            analytics.track('auth_succeeded', { provider: 'central_auth' }, traceId);
          }
        }
      }
    } catch (err) {
      analytics.track('auth_failed', { provider: 'central_auth', error_code: 'AUTH-101', retryable: true }, traceId);
      console.error('Failed to open SSO page', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card elevated style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="book" size="lg" color={colors.primary} />
          </View>
          <Text variant="heading" style={{ marginTop: spacing.xs }}>
            {t('auth.centralTitle')}
          </Text>
          <Text variant="caption" color="muted" style={{ textAlign: 'center' }}>
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

        <View style={[styles.featuresList, { marginVertical: spacing.md }]}>
          <View style={styles.featureItem}>
            <Icon name="sparkles" size="sm" color={colors.primary} />
            <Text variant="caption" color="muted" style={styles.featureText}>
              Personal Vocabulary Capture — save words with context and usage
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="sync-outline" size="sm" color={colors.primary} />
            <Text variant="caption" color="muted" style={styles.featureText}>
              Spaced Repetition (FSRS) — retain memory across all devices
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="shield-checkmark-outline" size="sm" color={colors.primary} />
            <Text variant="caption" color="muted" style={styles.featureText}>
              Platform Sign-In — safe Google authentication without local passwords
            </Text>
          </View>
        </View>

        <Text variant="body" color="muted" style={[styles.desc, { marginBottom: spacing.md }]}>
          {t('auth.centralDescription')}
        </Text>

        <Button
          label={t('auth.centralSignIn')}
          loading={busy}
          onPress={handleSignIn}
          style={{ width: '100%' }}
        />

        {onContinueBrowsing && (
          <Button
            label="Browse without signing in"
            variant="tonal"
            onPress={onContinueBrowsing}
            style={{ width: '100%', marginTop: spacing.sm }}
          />
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, alignItems: 'center', padding: 28 },
  header: { alignItems: 'center', gap: 6 },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  desc: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
  featuresList: {
    width: '100%',
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
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
