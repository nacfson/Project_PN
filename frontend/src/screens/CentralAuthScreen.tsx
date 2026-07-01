import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { CENTRAL_AUTH_URL } from '../config';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Card, Icon, Text } from '../ui';

export function CentralAuthScreen() {
  const { colors, spacing } = useTheme();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      const redirectUrl = Platform.OS === 'web' ? window.location.origin : 'projectpn://auth';
      const authUrl = `${CENTRAL_AUTH_URL}/login?rd=${encodeURIComponent(redirectUrl)}`;
      await Linking.openURL(authUrl);
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
          <Icon name="shield-lock" size="lg" color={colors.primary} />
          <Text variant="heading" style={{ marginTop: spacing.sm }}>Project PN</Text>
          <Text color="muted" style={{ textAlign: 'center' }}>
            A word is global, but memory is personal.
          </Text>
        </View>
        <Text variant="body" color="muted" style={[styles.desc, { marginVertical: spacing.md }]}>
          Sign in securely using Nacfson Cloud to synchronize your personal vocabulary lists, reviews, and spaced repetition progress across devices.
        </Text>
        <Button
          label="Sign In with Nacfson Cloud"
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
});
