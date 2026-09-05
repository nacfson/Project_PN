import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { cancelLinkRequest, me, resendLinkRequest } from '../../api/auth';
import { useAppLanguage } from '../../i18n';
import { navigateToLinkPropose } from '../../navigation/navigationRef';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Text } from '../../ui';
import type { LinkRequest, MeResponse } from '@project-pn/api';
import { notifyAuthProfileChanged, onAuthProfileChanged } from './authProfileEvents';

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

  useEffect(() => onAuthProfileChanged(() => {
    void load();
  }), [load]);

  const linkRequest = profile?.link_request ?? null;
  const recommendation = profile?.link_recommendation ?? null;

  if (dismissed || (!linkRequest && !recommendation)) {
    return null;
  }

  const provider = linkRequest?.pending_provider ?? recommendation?.provider ?? 'google';
  const email = linkRequest?.email ?? recommendation?.email ?? '';
  const providerLabel =
    provider === 'google' ? t('settings.providerGoogle') : t('settings.providerEmail');

  const handleResend = async (req: LinkRequest) => {
    setBusy(true);
    setError(null);
    try {
      await resendLinkRequest(req.id);
      await load();
    } catch {
      setError(t('auth.linkResendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (req: LinkRequest) => {
    setBusy(true);
    setError(null);
    try {
      await cancelLinkRequest(req.id);
      setDismissed(true);
      await load();
      notifyAuthProfileChanged();
      onLinked?.();
    } catch {
      setError(t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  if (linkRequest && linkRequest.status === 'pending') {
    return (
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colors.warningSurface,
            borderColor: colors.warningBorder,
            marginHorizontal: spacing.md,
            marginBottom: spacing.sm,
          },
        ]}
      >
        <View style={styles.header}>
          <Icon name="mail-outline" size="md" color={colors.warning} />
          <View style={styles.copy}>
            <Text variant="label">{t('auth.linkPendingTitle')}</Text>
            <Text color="muted" style={styles.body}>
              {t('auth.linkPendingBody', { email: linkRequest.email })}
            </Text>
          </View>
          <Pressable onPress={() => setDismissed(true)} accessibilityLabel={t('common.close')}>
            <Icon name="close" size="md" color={colors.textMuted} />
          </Pressable>
        </View>
        {error ? (
          <Text style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</Text>
        ) : null}
        <Button
          label={t('auth.linkResend')}
          loading={busy}
          onPress={() => void handleResend(linkRequest)}
        />
        <Button
          label={t('auth.linkCancelRequest')}
          variant="ghost"
          disabled={busy}
          onPress={() => void handleCancel(linkRequest)}
        />
      </View>
    );
  }

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
            {t('auth.linkAccountNotice', { provider: providerLabel, email })}
          </Text>
        </View>
        <Pressable onPress={() => setDismissed(true)} accessibilityLabel={t('common.close')}>
          <Icon name="close" size="md" color={colors.textMuted} />
        </Pressable>
      </View>
      {error ? (
        <Text style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</Text>
      ) : null}
      <Button
        label={t('auth.linkReview')}
        onPress={() => navigateToLinkPropose(String(provider), email)}
      />
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
