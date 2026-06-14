import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { logout, me } from '../../api/auth';
import type { MeResponse } from '../../types/auth';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Screen, Text } from '../../ui';

interface ProfileScreenProps {
  onLogout: () => void;
}

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { colors, spacing } = useTheme();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await me();
        setUser(profile);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }, [onLogout]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded>
      <View style={[styles.content, { paddingVertical: spacing.lg, gap: spacing.lg }]}>
        <Text variant="heading">Profile</Text>

        <Card>
          <Text variant="label" muted>
            Email
          </Text>
          <Text style={{ marginTop: spacing.xs }}>{user?.email ?? 'Unknown'}</Text>
        </Card>

        <Button label="Log out" variant="secondary" loading={loggingOut} onPress={() => void handleLogout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
