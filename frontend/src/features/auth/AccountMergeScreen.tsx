import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { confirmMergeRequest, createMergeRequest, logout } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Screen, Text } from '../../ui';

export function AccountMergeScreen() {
  const { colors, spacing } = useTheme();
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
    <Screen title={t('auth.mergeTitle')} padded>
      <Card glass style={{ gap: spacing.md }}>
        <Text>{t('auth.mergeDescription')}</Text>
        <View style={[styles.warning, { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder }]}>
          <Text style={{ color: colors.danger }}>{t('auth.mergeWarning')}</Text>
        </View>
        <Text color="muted">{t('auth.mergeSource', { email: sourceEmail })}</Text>
        <Text color="muted">{t('auth.mergeTarget', { email: targetEmail })}</Text>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Button label={t('auth.mergeConfirm')} loading={busy} onPress={() => void handleMerge()} />
      </Card>
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
