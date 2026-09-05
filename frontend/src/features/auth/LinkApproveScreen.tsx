import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { confirmLinkRequest, me } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, Screen, Text } from '../../ui';
import { notifyAuthProfileChanged } from './authProfileEvents';

export function LinkApproveScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'LinkApprove'>>();
  const requestId = route.params?.requestId ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string>('google');
  const [email, setEmail] = useState('');

  useEffect(() => {
    void me()
      .then((profile) => {
        if (profile.link_request) {
          setPendingProvider(profile.link_request.pending_provider);
          setEmail(profile.link_request.email);
        } else if (profile.link_recommendation) {
          setPendingProvider(profile.link_recommendation.provider);
          setEmail(profile.link_recommendation.email);
        } else {
          setEmail(profile.email);
        }
      })
      .catch(() => {
        setError(t('common.somethingWrong'));
      });
  }, [t]);

  const providerLabel =
    pendingProvider === 'google' ? t('settings.providerGoogle') : t('settings.providerEmail');

  const handleApprove = useCallback(async () => {
    if (!requestId) {
      setError(t('auth.linkApproveMissing'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmLinkRequest(requestId);
      setDone(true);
      notifyAuthProfileChanged();
    } catch {
      setError(t('auth.linkApproveFailed'));
    } finally {
      setBusy(false);
    }
  }, [requestId, t]);

  if (done) {
    return (
      <Screen title={t('auth.linkApproveTitle')} padded>
        <Card glass style={{ gap: spacing.md, alignItems: 'center' }}>
          <Icon name="checkmark-circle" size="lg" color={colors.primary} />
          <Text variant="label">{t('auth.linkAccountSuccess')}</Text>
          <Text color="muted" style={styles.center}>
            {t('auth.linkApproveDoneBody')}
          </Text>
          <Button
            label={t('common.close')}
            onPress={() => navigation.navigate('ConnectedAccounts')}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('auth.linkApproveTitle')} padded>
      <Card glass style={{ gap: spacing.md }}>
        <Text>{t('auth.linkApproveBody', { provider: providerLabel, email })}</Text>
        <View style={[styles.banner, { backgroundColor: colors.primaryContainer, borderColor: colors.outlineVariant }]}>
          <Text variant="label">{t('auth.linkApproveSessionHint')}</Text>
          <Text color="muted" style={styles.hint}>
            {t('auth.linkApproveSessionBody')}
          </Text>
        </View>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Button
          label={t('auth.linkApproveConfirm')}
          loading={busy}
          disabled={!requestId}
          onPress={() => void handleApprove()}
        />
        <Button label={t('auth.linkDecline')} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  hint: { fontSize: 14, lineHeight: 20 },
  center: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
