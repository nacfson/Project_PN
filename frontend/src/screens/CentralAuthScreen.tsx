import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CENTRAL_AUTH_URL } from '../config';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Text } from '../ui';
import { sessionStorage } from '../api/storage';
import { extractTokenFromUrl } from '../utils/authLaunch';

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
    try {
      const redirectUrl = Platform.OS === 'web' ? window.location.origin : 'projectpn://auth';
      const authUrl = `${CENTRAL_AUTH_URL}/login?rd=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (result.type === 'success') {
          const token = extractTokenFromUrl(result.url);
          if (token) {
            await sessionStorage.setToken(token);
            if (onTokenReceived) {
              onTokenReceived();
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to open SSO page', err);
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
