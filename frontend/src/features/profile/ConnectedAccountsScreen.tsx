import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LinkedProvider } from '@project-pn/api';
import { getLinkedProviders } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Icon, LoadingState, Screen, Text } from '../../ui';

function providerLabel(provider: string, t: (key: string) => string): string {
  if (provider === 'google') return t('settings.providerGoogle');
  return provider;
}

export function ConnectedAccountsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [providers, setProviders] = useState<LinkedProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await getLinkedProviders());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen title={t('settings.connectedAccounts')} padded>
      {loading ? (
        <LoadingState />
      ) : (
        <Card glass style={{ gap: spacing.md }}>
          {providers.length === 0 ? (
            <Text color="muted">{t('settings.connectedAccountsEmpty')}</Text>
          ) : (
            providers.map((item) => (
              <View key={`${item.provider}-${item.email}`} style={styles.row}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
                  <Icon
                    name="logo-google"
                    size="md"
                    color={colors.primary}
                  />
                </View>
                <View style={styles.copy}>
                  <Text variant="body">{providerLabel(item.provider, t)}</Text>
                  <Text color="muted">{item.email}</Text>
                </View>
                <Icon name="checkmark-circle" size="md" color={colors.primary} />
              </View>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
});
