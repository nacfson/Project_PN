import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { linkProvider, me } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Text } from '../../ui';
import type { MeResponse } from '@project-pn/api';

interface LinkAccountBannerProps {
  onLinked?: () => void;
}

export function LinkAccountBanner({ onLinked }: LinkAccountBannerProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await me();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recommendation = profile?.link_recommendation;
  if (!recommendation || dismissed) {
    return null;
  }

  const providerLabel =
    recommendation.provider === 'google' ? t('settings.providerGoogle') : t('settings.providerEmail');

  const handleLink = async () => {
    setBusy(true);
    setError(null);
    try {
      await linkProvider();
      await load();
      onLinked?.();
    } catch {
      setError(t('auth.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.primaryContainer,
          borderColor: colors.outlineVariant,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.header}>
        <Icon name="link-outline" size="md" color={colors.primary} />
        <View style={styles.copy}>
          <Text variant="label">{t('auth.linkAccountTitle')}</Text>
          <Text color="muted" style={styles.body}>
            {t('auth.linkAccountBody', { provider: providerLabel, email: recommendation.email })}
          </Text>
        </View>
        <Pressable onPress={() => setDismissed(true)} accessibilityLabel={t('common.close')}>
          <Icon name="close" size="md" color={colors.textMuted} />
        </Pressable>
      </View>
      {error ? (
        <Text style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</Text>
      ) : null}
      <Button label={t('auth.linkAccountConfirm')} loading={busy} onPress={() => void handleLink()} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
