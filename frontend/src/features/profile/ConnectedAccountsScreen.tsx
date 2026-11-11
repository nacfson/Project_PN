import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LinkedProvider } from '@project-pn/api';
import { getLinkedProviders } from '../../api/auth';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import { spacing, useTheme } from '../../theme';
import {
  Card,
  Icon,
  LoadingState,
  PageColumn,
  Screen,
  SettingsGroup,
  SettingsRow,
  Text,
} from '../../ui';

function providerLabel(provider: string, t: (key: TranslationKey) => string): string {
  if (provider === 'google') return t('settings.providerGoogle');
  return provider;
}

export function ConnectedAccountsScreen() {
  const { colors } = useTheme();
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
    <Screen title={t('settings.connectedAccounts')}>
      <PageColumn style={{ paddingTop: spacing.md }}>
        {loading ? (
          <LoadingState />
        ) : providers.length === 0 ? (
          <Card>
            <Text color={colors.textSecondary}>{t('settings.connectedAccountsEmpty')}</Text>
          </Card>
        ) : (
          <SettingsGroup>
            {providers.map((item) => (
              <SettingsRow
                key={`${item.provider}-${item.email}`}
                title={providerLabel(item.provider, t)}
                subtitle={item.email}
                trailing={
                  <View style={styles.trailing}>
                    <Icon name="logo-google" size="sm" color={colors.accent} />
                    <Icon name="checkmark-circle" size="md" color={colors.success} />
                  </View>
                }
              />
            ))}
          </SettingsGroup>
        )}
      </PageColumn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
