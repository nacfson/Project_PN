import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { createLinkRequest, me } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, Screen, Text } from '../../ui';
import { notifyAuthProfileChanged } from './authProfileEvents';

export function LinkAccountProposeScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'LinkAccountPropose'>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackShare, setAckShare] = useState(false);
  const [ackOwn, setAckOwn] = useState(false);

  const provider = route.params?.provider ?? 'google';
  const email = route.params?.email ?? '';
  const providerLabel =
    provider === 'google' ? t('settings.providerGoogle') : t('settings.providerEmail');

  const canSend = ackShare && ackOwn && !busy;

  const handleSend = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await createLinkRequest();
      await me();
      notifyAuthProfileChanged();
      navigation.goBack();
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }, [navigation, t]);

  return (
    <Screen title={t('auth.linkProposeTitle')} padded>
      <Card glass style={{ gap: spacing.md }}>
        <Text>{t('auth.linkProposeBody')}</Text>

        <View style={[styles.idRow, { borderColor: colors.primary }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="logo-google" size="md" color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text variant="body">{providerLabel}</Text>
            <Text color="muted">{email}</Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 12 }}>{t('auth.linkYouBadge')}</Text>
        </View>

        <Text color="muted" style={styles.center}>
          {t('auth.linkRequestArrow')}
        </Text>

        <View style={[styles.idRow, { borderColor: colors.outlineVariant, borderStyle: 'dashed' }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="mail-outline" size="md" color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text variant="body">{t('settings.providerEmail')}</Text>
            <Text color="muted">{email}</Text>
          </View>
          <Text style={{ color: colors.warning, fontSize: 12 }}>
            {t('auth.linkMustApprove')}
          </Text>
        </View>

        <Pressable style={styles.checkRow} onPress={() => setAckShare((v) => !v)}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: ackShare ? colors.primary : colors.surface,
              },
            ]}
          />
          <Text color="muted" style={styles.checkLabel}>
            {t('auth.linkAckShare')}
          </Text>
        </Pressable>
        <Pressable style={styles.checkRow} onPress={() => setAckOwn((v) => !v)}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: ackOwn ? colors.primary : colors.surface,
              },
            ]}
          />
          <Text color="muted" style={styles.checkLabel}>
            {t('auth.linkAckOwn')}
          </Text>
        </Pressable>

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        <Button
          label={t('auth.linkSendRequest')}
          loading={busy}
          disabled={!canSend}
          onPress={() => void handleSend()}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  center: { textAlign: 'center', fontSize: 13 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    marginTop: 2,
  },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
});
