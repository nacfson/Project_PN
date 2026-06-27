import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logout, me } from '../../api/auth';
import { getReviewSettings, patchReviewSettings } from '../../api/reviewSettings';
import { getStreakSettings, patchStreakSettings } from '../../api/streakSettings';
import { type AppLanguage, useAppLanguage } from '../../i18n';
import type { MeResponse } from '../../types/auth';
import type { ReviewSettings, StreakSettings } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, Input, LoadingState, Screen, Switch, Text } from '../../ui';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';

interface ProfileScreenProps {
  onLogout: () => void;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
  trailing,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
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
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.errorContainer : colors.primaryContainer }]}>
        <Icon name={icon} size="md" color={danger ? colors.error : colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text variant="body" style={{ color: danger ? colors.error : colors.onSurface }}>
          {label}
        </Text>
        {value ? (
          <Text variant="caption" color="muted">
            {value}
          </Text>
        ) : null}
      </View>
      {trailing || (onPress && <Icon name="chevron-forward" size="sm" />)}
    </Pressable>
  );
}

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { colors, spacing, mode, toggleMode } = useTheme();
  const { language, setLanguage, t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [reviewSettings, setReviewSettings] = useState<ReviewSettings | null>(null);
  const [streakSettings, setStreakSettings] = useState<StreakSettings | null>(null);
  const [dailyGoalInput, setDailyGoalInput] = useState('200');
  const [retentionInput, setRetentionInput] = useState('0.90');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingDailyGoal, setSavingDailyGoal] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [savingStreak, setSavingStreak] = useState(false);
  const [dailyGoalError, setDailyGoalError] = useState<string | undefined>();
  const [retentionError, setRetentionError] = useState<string | undefined>();
  const [streakError, setStreakError] = useState<string | undefined>();

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

  useEffect(() => {
    void (async () => {
      try {
        const [review, streak] = await Promise.all([getReviewSettings(), getStreakSettings()]);
        setReviewSettings(review);
        setStreakSettings(streak);
        setDailyGoalInput(String(review.daily_goal_xp));
        setRetentionInput(review.desired_retention.toFixed(2));
      } catch {
        setReviewSettings(null);
        setStreakSettings(null);
      } finally {
        setSettingsLoading(false);
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

  const chooseLanguage = useCallback(
    (nextLanguage: AppLanguage) => {
      void setLanguage(nextLanguage);
      setShowLanguageSelector(false);
    },
    [setLanguage],
  );

  const saveDailyGoal = useCallback(async () => {
    const parsed = Number.parseInt(dailyGoalInput, 10);
    if (!Number.isFinite(parsed) || parsed < 10) {
      setDailyGoalError(t('settings.dailyGoalHelp'));
      return;
    }
    setSavingDailyGoal(true);
    setDailyGoalError(undefined);
    try {
      const updated = await patchReviewSettings({ daily_goal_xp: parsed });
      setReviewSettings(updated);
      setDailyGoalInput(String(updated.daily_goal_xp));
    } catch {
      setDailyGoalError(t('settings.dailyGoalSaveFailed'));
    } finally {
      setSavingDailyGoal(false);
    }
  }, [dailyGoalInput, t]);

  const saveRetention = useCallback(async () => {
    const parsed = Number.parseFloat(retentionInput);
    if (!Number.isFinite(parsed) || parsed < 0.7 || parsed > 0.99) {
      setRetentionError(t('settings.desiredRetentionHelp'));
      return;
    }
    setSavingRetention(true);
    setRetentionError(undefined);
    try {
      const updated = await patchReviewSettings({ desired_retention: parsed });
      setReviewSettings(updated);
      setRetentionInput(updated.desired_retention.toFixed(2));
    } catch {
      setRetentionError(t('settings.desiredRetentionSaveFailed'));
    } finally {
      setSavingRetention(false);
    }
  }, [retentionInput, t]);

  const enableVacationMode = useCallback(async () => {
    setSavingStreak(true);
    setStreakError(undefined);
    try {
      const until = new Date();
      until.setUTCDate(until.getUTCDate() + 7);
      const updated = await patchStreakSettings({
        vacation_mode_until: until.toISOString().slice(0, 10),
      });
      setStreakSettings(updated);
    } catch {
      setStreakError(t('settings.vacationModeSaveFailed'));
    } finally {
      setSavingStreak(false);
    }
  }, [t]);

  const disableVacationMode = useCallback(async () => {
    setSavingStreak(true);
    setStreakError(undefined);
    try {
      const updated = await patchStreakSettings({ vacation_mode_until: '' });
      setStreakSettings(updated);
    } catch {
      setStreakError(t('settings.vacationModeSaveFailed'));
    } finally {
      setSavingStreak(false);
    }
  }, [t]);

  const useStreakFreeze = useCallback(async () => {
    if (!streakSettings || streakSettings.streak_freeze_tokens <= 0) {
      setStreakError(t('settings.streakFreezeUnavailable'));
      return;
    }
    setSavingStreak(true);
    setStreakError(undefined);
    try {
      const updated = await patchStreakSettings({ use_streak_freeze: true });
      setStreakSettings(updated);
    } catch {
      setStreakError(t('settings.streakFreezeSaveFailed'));
    } finally {
      setSavingStreak(false);
    }
  }, [streakSettings, t]);

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
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          <SettingRow
            icon="language-outline"
            label={t('settings.languagePairs')}
            value={`${languageLabel(user?.target_language)}${user?.target_language ? ' → ' : ''}${languageLabel(user?.native_language)}`}
            onPress={() => navigation.navigate('LanguagePairs')}
          />
        </Card>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('settings.review')}
            </Text>
          </View>
          {settingsLoading ? (
            <Text color="muted">{t('app.loading')}</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Text variant="label">{t('settings.dailyGoal')}</Text>
              <Input
                value={dailyGoalInput}
                onChangeText={setDailyGoalInput}
                keyboardType="number-pad"
                helperText={dailyGoalError ?? t('settings.dailyGoalHelp')}
                error={Boolean(dailyGoalError)}
                onBlur={() => setDailyGoalError(undefined)}
              />
              <Button
                label={t('settings.save')}
                variant="tonal"
                loading={savingDailyGoal}
                onPress={() => void saveDailyGoal()}
              />

              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

              <Text variant="label">{t('settings.desiredRetention')}</Text>
              <Input
                value={retentionInput}
                onChangeText={setRetentionInput}
                keyboardType="decimal-pad"
                helperText={retentionError ?? t('settings.desiredRetentionHelp')}
                error={Boolean(retentionError)}
                onBlur={() => setRetentionError(undefined)}
              />
              <Button
                label={t('settings.save')}
                variant="tonal"
                loading={savingRetention}
                onPress={() => void saveRetention()}
              />

              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

              <Text variant="label">{t('settings.streak')}</Text>
              <Text variant="caption" color="muted">
                {streakSettings?.vacation_mode_active && streakSettings.vacation_mode_until
                  ? t('settings.vacationModeActive', { date: streakSettings.vacation_mode_until })
                  : t('settings.vacationModeOff')}
              </Text>
              <View style={{ gap: spacing.sm }}>
                {streakSettings?.vacation_mode_active ? (
                  <Button
                    label={t('settings.vacationModeDisable')}
                    variant="tonal"
                    loading={savingStreak}
                    onPress={() => void disableVacationMode()}
                  />
                ) : (
                  <Button
                    label={t('settings.vacationModeEnable')}
                    variant="tonal"
                    loading={savingStreak}
                    onPress={() => void enableVacationMode()}
                  />
                )}
                <Button
                  label={t('settings.streakFreeze')}
                  variant="tonal"
                  loading={savingStreak}
                  disabled={!streakSettings || streakSettings.streak_freeze_tokens <= 0}
                  onPress={() => void useStreakFreeze()}
                />
              </View>
              {streakError ? (
                <Text variant="caption" color="danger">
                  {streakError}
                </Text>
              ) : null}
              <Text variant="caption" color="muted">
                {t('settings.streakFreezeHelp')}
              </Text>
            </View>
          )}
        </Card>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('settings.app')}
            </Text>
          </View>
          <SettingRow
            icon={mode === 'dark' ? 'moon-outline' : 'sunny-outline'}
            label={t('settings.darkTheme')}
            trailing={<Switch value={mode === 'dark'} onValueChange={() => toggleMode()} />}
          />
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
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
                variant={language === 'en' ? 'primary' : 'tonal'}
                onPress={() => chooseLanguage('en')}
              />
              <Button
                label={t('language.ko')}
                variant={language === 'ko' ? 'primary' : 'tonal'}
                onPress={() => chooseLanguage('ko')}
              />
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          <SettingRow icon="help-circle-outline" label={t('settings.help')} />
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
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
