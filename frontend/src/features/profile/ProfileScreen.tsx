import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logout, me } from '../../api/auth';
import { getReviewSettings, patchReviewSettings } from '../../api/reviewSettings';
import { getStreakSettings, patchStreakSettings } from '../../api/streakSettings';
import { type AppLanguage, useAppLanguage } from '../../i18n';
import { shellKind, shellLayout } from '../../navigation/shellKind';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { radii, spacing, useTheme } from '../../theme';
import type { ReviewSettings, StreakSettings } from '../../types';
import type { MeResponse } from '../../types/auth';
import {
  Button,
  LoadingState,
  PageColumn,
  Screen,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  Switch,
  Text,
} from '../../ui';
import { goalOptions } from './dailyGoal';

interface ProfileScreenProps {
  onLogout: () => void;
}

const RETENTION_MIN = 70;
const RETENTION_MAX = 97;

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { colors } = useTheme();
  const { language, setLanguage, t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isWide = shellLayout(shellKind(Platform.OS, ua), width) === 'sidebar' && width >= 640;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [reviewSettings, setReviewSettings] = useState<ReviewSettings | null>(null);
  const [streakSettings, setStreakSettings] = useState<StreakSettings | null>(null);

  const [savedGoalXp, setSavedGoalXp] = useState<number>(200);
  const [selectedGoalXp, setSelectedGoalXp] = useState<number>(200);
  const [retentionPercent, setRetentionPercent] = useState<number>(90);

  const [savingStreak, setSavingStreak] = useState(false);
  const [dailyGoalError, setDailyGoalError] = useState<string | undefined>();
  const [retentionError, setRetentionError] = useState<string | undefined>();
  const [streakError, setStreakError] = useState<string | undefined>();
  const [logoutError, setLogoutError] = useState<string | undefined>();

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
        setSavedGoalXp(review.daily_goal_xp);
        setSelectedGoalXp(review.daily_goal_xp);
        setRetentionPercent(Math.round(review.desired_retention * 100));
      } catch {
        setReviewSettings(null);
        setStreakSettings(null);
      }
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setLogoutError(undefined);
    try {
      await logout();
      onLogout();
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 401) {
        onLogout();
        return;
      }
      setLogoutError(t('settings.logoutFailed'));
    } finally {
      setLoggingOut(false);
    }
  }, [onLogout, t]);

  const handleSelectDailyGoal = useCallback(
    async (valueStr: string) => {
      const nextGoal = Number.parseInt(valueStr, 10);
      if (!Number.isFinite(nextGoal) || nextGoal === selectedGoalXp) return;

      const prevGoal = selectedGoalXp;
      setSelectedGoalXp(nextGoal);
      setDailyGoalError(undefined);

      try {
        const updated = await patchReviewSettings({ daily_goal_xp: nextGoal });
        const committed = updated?.daily_goal_xp ?? nextGoal;
        setReviewSettings((prev) => (prev ? { ...prev, ...updated, daily_goal_xp: committed } : updated));
        setSavedGoalXp(committed);
        setSelectedGoalXp(committed);
      } catch {
        setSelectedGoalXp(prevGoal);
        setDailyGoalError(t('settings.dailyGoalSaveFailed'));
      }
    },
    [selectedGoalXp, t],
  );

  const commitRetentionPercent = useCallback(
    async (nextPercent: number) => {
      const clamped = Math.max(RETENTION_MIN, Math.min(RETENTION_MAX, Math.round(nextPercent)));
      const prevPercent = retentionPercent;
      setRetentionPercent(clamped);
      setRetentionError(undefined);

      const decimal = Number((clamped / 100).toFixed(2));
      try {
        const updated = await patchReviewSettings({ desired_retention: decimal });
        const committedDecimal = updated?.desired_retention ?? decimal;
        setReviewSettings((prev) =>
          prev ? { ...prev, ...updated, desired_retention: committedDecimal } : updated,
        );
        setRetentionPercent(Math.round(committedDecimal * 100));
      } catch {
        setRetentionPercent(prevPercent);
        setRetentionError(t('settings.desiredRetentionSaveFailed'));
      }
    },
    [retentionPercent, t],
  );

  const handleToggleVacation = useCallback(
    async (nextActive: boolean) => {
      setSavingStreak(true);
      setStreakError(undefined);
      const prevStreak = streakSettings;
      setStreakSettings((prev) =>
        prev ? { ...prev, vacation_mode_active: nextActive } : prev,
      );

      try {
        if (nextActive) {
          const until = new Date();
          until.setUTCDate(until.getUTCDate() + 7);
          const updated = await patchStreakSettings({
            vacation_mode_until: until.toISOString().slice(0, 10),
          });
          setStreakSettings(
            updated ?? {
              ...(prevStreak ?? { streak_freeze_tokens: 0 }),
              vacation_mode_active: true,
              vacation_mode_until: until.toISOString().slice(0, 10),
            },
          );
        } else {
          const updated = await patchStreakSettings({ vacation_mode_until: '' });
          setStreakSettings(
            updated ?? {
              ...(prevStreak ?? { streak_freeze_tokens: 0 }),
              vacation_mode_active: false,
              vacation_mode_until: null,
            },
          );
        }
      } catch {
        setStreakSettings(prevStreak);
        setStreakError(t('settings.vacationModeSaveFailed'));
      } finally {
        setSavingStreak(false);
      }
    },
    [streakSettings, t],
  );

  const useStreakFreeze = useCallback(async () => {
    if (!streakSettings || streakSettings.streak_freeze_tokens <= 0) {
      setStreakError(t('settings.streakFreezeUnavailable'));
      return;
    }
    setSavingStreak(true);
    setStreakError(undefined);
    try {
      const updated = await patchStreakSettings({ use_streak_freeze: true });
      if (updated) {
        setStreakSettings(updated);
      }
    } catch {
      setStreakError(t('settings.streakFreezeSaveFailed'));
    } finally {
      setSavingStreak(false);
    }
  }, [streakSettings, t]);

  const dailyGoalSegments = useMemo(
    () =>
      goalOptions(savedGoalXp).map((opt) => ({
        value: String(opt.value),
        label: String(opt.value),
        testID: `daily-goal-option-${opt.value}`,
      })),
    [savedGoalXp],
  );

  const languageSegments = useMemo(
    () => [
      { value: 'en' as AppLanguage, label: t('language.en'), testID: 'app-language-en' },
      { value: 'ko' as AppLanguage, label: t('language.ko'), testID: 'app-language-ko' },
    ],
    [t],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const activePairLabel = `${languageLabel(user?.target_language)}${
    user?.target_language ? ' → ' : ''
  }${languageLabel(user?.native_language)}`;

  const vacationSubtitle =
    streakSettings?.vacation_mode_active && streakSettings.vacation_mode_until
      ? t('settings.vacationModeActive', { date: streakSettings.vacation_mode_until })
      : t('settings.vacationSubtitle');

  const freezeTokens = streakSettings?.streak_freeze_tokens ?? 0;
  const retentionRatio =
    (retentionPercent - RETENTION_MIN) / (RETENTION_MAX - RETENTION_MIN);

  return (
    <Screen>
      <PageColumn style={styles.page}>
        <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
          <Text variant="pageTitle">{t('settings.title')}</Text>
          <Text variant="bodySmall" color={colors.textSecondary}>
            {t('settings.autosaveNote')}
          </Text>
        </View>

        {/* 1. Account */}
        <SettingsGroup title={t('settings.groupAccount')}>
          <SettingsRow
            testID="settings-row-email"
            title={t('settings.email')}
            trailing={
              <Text variant="bodySmall" color={colors.textSecondary}>
                {user?.email ?? t('common.unknown')}
              </Text>
            }
          />
          <SettingsRow
            testID="settings-row-connected-accounts"
            title={t('settings.connectedAccounts')}
            onPress={() => navigation.navigate('ConnectedAccounts')}
          />
          {user?.merge_suggestion ? (
            <SettingsRow
              testID="settings-row-account-merge"
              title={t('auth.mergeSuggestion', { domain: user.merge_suggestion.domain })}
              onPress={() =>
                navigation.navigate('AccountMerge', {
                  sourceUserId: user.merge_suggestion!.source_user_id,
                  sourceEmail: user.merge_suggestion!.source_email,
                  targetEmail: user.email,
                })
              }
            />
          ) : null}
          <SettingsRow
            testID="settings-row-language-pairs"
            title={t('settings.languagePairs')}
            subtitle={t('settings.languagePairsDescription')}
            trailing={
              <Text variant="bodySmall" color={colors.textSecondary}>
                {activePairLabel}
              </Text>
            }
            onPress={() => navigation.navigate('LanguagePairs')}
          />
        </SettingsGroup>

        {/* 2. Review */}
        <SettingsGroup title={t('settings.groupReview')}>
          <SettingsRow
            testID="settings-row-daily-goal"
            stacked={!isWide}
            title={t('settings.dailyGoal')}
            subtitle={dailyGoalError ?? t('settings.dailyGoalSubtitle')}
            trailing={
              <SegmentedControl
                tone="alt"
                role="radiogroup"
                options={dailyGoalSegments}
                value={String(selectedGoalXp)}
                onChange={(val) => void handleSelectDailyGoal(val)}
                style={!isWide ? { width: '100%' } : undefined}
              />
            }
          />
          {dailyGoalError ? (
            <View style={styles.inlineErrorWrap}>
              <Text variant="caption" color={colors.danger} testID="daily-goal-error">
                {dailyGoalError}
              </Text>
            </View>
          ) : null}

          <SettingsRow
            testID="settings-row-retention"
            stacked={!isWide}
            title={t('settings.desiredRetention')}
            subtitle={retentionError ?? t('settings.retentionSubtitle')}
            trailing={
              <View style={[styles.sliderControls, !isWide && styles.sliderControlsStacked]}>
                <Pressable
                  testID="retention-decrease"
                  accessibilityRole="button"
                  accessibilityLabel="Decrease retention"
                  onPress={() => void commitRetentionPercent(retentionPercent - 1)}
                  style={[styles.stepBtn, { borderColor: colors.controlBorder }]}
                >
                  <Text variant="bodySmall">-</Text>
                </Pressable>
                <View
                  testID="retention-slider"
                  accessibilityRole="adjustable"
                  accessibilityValue={{
                    min: RETENTION_MIN,
                    max: RETENTION_MAX,
                    now: retentionPercent,
                  }}
                  // Allow tests or custom events to invoke onValueChange directly
                  {...({
                    onValueChange: (val: number) => void commitRetentionPercent(val),
                  } as Record<string, unknown>)}
                  style={[
                    styles.sliderTrack,
                    !isWide && styles.sliderTrackStacked,
                    { backgroundColor: colors.fill },
                  ]}
                >
                  <View
                    style={[
                      styles.sliderFill,
                      {
                        width: `${Math.max(0, Math.min(100, retentionRatio * 100))}%`,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                </View>
                <Pressable
                  testID="retention-increase"
                  accessibilityRole="button"
                  accessibilityLabel="Increase retention"
                  onPress={() => void commitRetentionPercent(retentionPercent + 1)}
                  style={[styles.stepBtn, { borderColor: colors.controlBorder }]}
                >
                  <Text variant="bodySmall">+</Text>
                </Pressable>
                <Text
                  variant="bodySmall"
                  tabular
                  testID="retention-value"
                  style={styles.retentionLabel}
                >
                  {`${retentionPercent}%`}
                </Text>
              </View>
            }
          />
        </SettingsGroup>

        {/* 3. Streak */}
        <SettingsGroup title={t('settings.groupStreak')}>
          <SettingsRow
            testID="settings-row-vacation"
            title={t('settings.vacationMode')}
            subtitle={vacationSubtitle}
            trailing={
              <Switch
                testID="vacation-switch"
                value={Boolean(streakSettings?.vacation_mode_active)}
                disabled={savingStreak}
                onValueChange={(next) => void handleToggleVacation(next)}
              />
            }
          />
          <SettingsRow
            testID="settings-row-freeze"
            title={t('settings.streakFreeze')}
            subtitle={t('settings.freezeSubtitle', { count: freezeTokens })}
            trailing={
              <Button
                testID="use-freeze-button"
                label={t('settings.useFreeze')}
                variant="secondary"
                size="sm"
                loading={savingStreak}
                disabled={freezeTokens <= 0 || savingStreak}
                onPress={() => void useStreakFreeze()}
              />
            }
          />
          {streakError ? (
            <View style={styles.inlineErrorWrap}>
              <Text variant="caption" color={colors.danger}>
                {streakError}
              </Text>
            </View>
          ) : null}
        </SettingsGroup>

        {/* 4. Appearance (App language only — no Theme row) */}
        <SettingsGroup title={t('settings.groupAppearance')}>
          <SettingsRow
            testID="settings-row-app-language"
            title={t('settings.appLanguage')}
            trailing={
              <SegmentedControl
                tone="alt"
                role="radiogroup"
                options={languageSegments}
                value={language}
                onChange={(nextLang) => void setLanguage(nextLang)}
              />
            }
          />
        </SettingsGroup>

        {/* 5. Help / About / Log out */}
        <SettingsGroup>
          <SettingsRow
            testID="settings-row-help"
            title={t('settings.help')}
          />
          <SettingsRow
            testID="settings-row-about"
            title={t('settings.about')}
          />
          <SettingsRow
            testID="settings-row-logout"
            title={t('settings.logOut')}
            tone="danger"
            disabled={loggingOut}
            onPress={() => void handleLogout()}
          />
        </SettingsGroup>

        {logoutError ? (
          <Text variant="caption" color={colors.danger}>
            {logoutError}
          </Text>
        ) : null}
      </PageColumn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    gap: 4,
  },
  inlineErrorWrap: {
    paddingHorizontal: 18,
    paddingBottom: spacing.sm,
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sliderControlsStacked: {
    width: '100%',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrack: {
    width: 96,
    height: 8,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  sliderTrackStacked: {
    flex: 1,
    width: undefined,
  },
  sliderFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  retentionLabel: {
    minWidth: 38,
    textAlign: 'right',
    fontWeight: '600',
  },
});
