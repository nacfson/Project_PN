import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { logout, me } from '../../api/auth';
import { type AppLanguage, useAppLanguage } from '../../i18n';
import type { MeResponse } from '../../types/auth';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, LoadingState, Screen, Text } from '../../ui';

interface ProfileScreenProps {
  onLogout: () => void;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: spacing.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.dangerSurface : colors.surfaceAlt }]}>
        <Icon name={icon} size="md" color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text variant="body" style={{ color: danger ? colors.danger : colors.text }}>
          {label}
        </Text>
        {value ? (
          <Text variant="caption" color="muted">
            {value}
          </Text>
        ) : null}
      </View>
      {onPress && <Icon name="chevron-forward" size="sm" />}
    </Pressable>
  );
}

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { colors, spacing } = useTheme();
  const { language, setLanguage, t } = useAppLanguage();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

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

  const languageLabel = useCallback(
    (code: string | undefined) => {
      switch (code) {
        case 'en':
          return t('language.enLearning');
        case 'ko':
          return t('language.koLearning');
        case 'ja':
          return t('language.jaLearning');
        case 'es':
          return t('language.esLearning');
        case 'fr':
          return t('language.frLearning');
        case 'de':
          return t('language.deLearning');
        case 'zh':
          return t('language.zhLearning');
        default:
          return code || t('common.unknown');
      }
    },
    [t],
  );

  const chooseLanguage = useCallback(
    (nextLanguage: AppLanguage) => {
      void setLanguage(nextLanguage);
      setShowLanguageSelector(false);
    },
    [setLanguage],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen padded>
      <View style={[styles.content, { paddingVertical: spacing.lg, gap: spacing.lg }]}>
        <Text variant="heading">{t('settings.title')}</Text>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('settings.account')}
            </Text>
          </View>
          <SettingRow icon="person-outline" label={t('settings.email')} value={user?.email ?? t('common.unknown')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="language-outline" label={t('settings.learningLanguage')} value={languageLabel(user?.target_language)} />
        </Card>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('settings.app')}
            </Text>
          </View>
          <SettingRow
            icon="language-outline"
            label={t('settings.appLanguage')}
            value={language === 'ko' ? t('language.ko') : t('language.en')}
            onPress={() => setShowLanguageSelector((visible) => !visible)}
          />
          {showLanguageSelector ? (
            <View style={[styles.languageOptions, { gap: spacing.sm }]}>
              <Button
                label={t('language.en')}
                variant={language === 'en' ? 'primary' : 'secondary'}
                onPress={() => chooseLanguage('en')}
              />
              <Button
                label={t('language.ko')}
                variant={language === 'ko' ? 'primary' : 'secondary'}
                onPress={() => chooseLanguage('ko')}
              />
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="help-circle-outline" label={t('settings.help')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="information-circle-outline" label={t('settings.about')} />
        </Card>

        <Button
          label={t('settings.logout')}
          variant="danger"
          loading={loggingOut}
          onPress={() => void handleLogout()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  divider: {
    height: 1,
    marginLeft: 48,
    marginVertical: 4,
  },
  languageOptions: {
    marginLeft: 48,
    marginVertical: 8,
  },
});
