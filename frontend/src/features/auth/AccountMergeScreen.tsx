import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { confirmMergeRequest, createMergeRequest, logout } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { spacing, useTheme } from '../../theme';
import { Button, Card, PageColumn, Screen, Text } from '../../ui';

export function AccountMergeScreen() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const route = useRoute<RouteProp<SettingsStackParamList, 'AccountMerge'>>();
  const { sourceUserId, sourceEmail, targetEmail } = route.params;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMerge = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await createMergeRequest(sourceUserId);
      await confirmMergeRequest(id);
      await logout();
    } catch {
      setError(t('common.somethingWrong'));
      setBusy(false);
    }
  };

  return (
    <Screen title={t('auth.mergeTitle')}>
      <PageColumn style={{ paddingTop: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <Text>{t('auth.mergeDescription')}</Text>
          <View
            style={[
              styles.warning,
              { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
            ]}
          >
            <Text color={colors.danger}>{t('auth.mergeWarning')}</Text>
          </View>
          <Text color={colors.textSecondary}>{t('auth.mergeSource', { email: sourceEmail })}</Text>
          <Text color={colors.textSecondary}>{t('auth.mergeTarget', { email: targetEmail })}</Text>
          {error ? <Text color={colors.danger}>{error}</Text> : null}
          <Button label={t('auth.mergeConfirm')} loading={busy} onPress={() => void handleMerge()} />
        </Card>
      </PageColumn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warning: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
});
