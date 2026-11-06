import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { getStatsSummary } from '../../api/stats';
import { getDueLearningItems } from '../../api/learningItems';
import { useAppLanguage } from '../../i18n';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useTheme } from '../../theme/ThemeProvider';
import { stageColor } from '../../theme/tokens';
import { shellKind, shellLayout } from '../../navigation/shellKind';
import type { DueItem, StatsSummary } from '../../types';
import {
  AnimatedProgressBar,
  Button,
  ErrorState,
  Kbd,
  PageColumn,
  Screen,
  SkeletonCard,
  Text,
} from '../../ui';
import { MasteryBar } from './MasteryBar';
import {
  XP_PER_REVIEW,
  estimateMinutes,
  goalPercent,
  mixNote,
  nextReviewAfterToday,
  remainingCount,
  totalWords,
} from './todaySummary';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Learn'>;

function formatTodayDate(lang: string): string {
  try {
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return new Date().toDateString();
  }
}

export function HomeScreen() {
  const { colors, spacing, radii, shadows } = useTheme();
  const { t, language } = useAppLanguage();
  const navigation = useNavigation<NavigationProp>();
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isWide = shellLayout(shellKind(Platform.OS, ua), width) === 'sidebar';

  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [upNext, setUpNext] = useState<DueItem[]>([]);
  const [statsError, setStatsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTodayData = useCallback((activeRef?: { current: boolean }) => {
    return Promise.all([getStatsSummary(), getDueLearningItems(5).catch(() => [] as DueItem[])])
      .then(([summary, dueItems]) => {
        if (activeRef && !activeRef.current) return;
        setStats(summary);
        setUpNext(Array.isArray(dueItems) ? dueItems.slice(0, 5) : []);
        setStatsError(false);
      })
      .catch(() => {
        if (activeRef && !activeRef.current) return;
        setStatsError(true);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const active = { current: true };
      void fetchTodayData(active);
      return () => {
        active.current = false;
      };
    }, [fetchTodayData]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTodayData().finally(() => {
      setRefreshing(false);
    });
  }, [fetchTodayData]);

  const handleRetry = useCallback(() => {
    setStatsError(false);
    void fetchTodayData();
  }, [fetchTodayData]);

  const dueCount = stats?.due_today ?? 0;
  const hasDue = dueCount > 0;

  const startReview = useCallback(() => {
    navigation.navigate('Practice', { origin: 'private' });
  }, [navigation]);

  useKeyboardShortcut('Enter', startReview, { enabled: Boolean(stats && hasDue) });

  const dateLabel = formatTodayDate(language);
  const minutes = estimateMinutes(dueCount);
  const mixKey = mixNote(upNext, dueCount);
  const xpToday = (stats?.reviews_today ?? 0) * XP_PER_REVIEW;
  const dailyGoalXp = stats?.daily_goal_xp ?? 200;
  const goalPct = goalPercent(xpToday, dailyGoalXp);
  const streakDays = stats?.review_streak_days ?? 0;
  const freezes = stats?.streak_freeze_tokens ?? 0;
  const wordsTotal = totalWords(stats?.stage_counts);
  const nextReview = nextReviewAfterToday(stats?.forecast);
  const remaining = remainingCount(dueCount, upNext.length);

  return (
    <Screen
      scrollEnabled
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.accent]}
        />
      }
    >
      <PageColumn>
        {statsError && !stats ? (
          <ErrorState message={t('home.statsLoadFailed')} onRetry={handleRetry} />
        ) : !stats ? (
          <View style={{ gap: spacing.lg }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </View>
        ) : (
          <View style={styles.sections}>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: hasDue ? colors.surfaceHighlight : colors.successSurface,
                  borderColor: hasDue ? colors.warningBright : colors.successBright,
                  borderRadius: radii.xxl,
                },
                shadows.playful,
              ]}
            >
              <View style={[styles.heroInner, { padding: isWide ? 32 : 24, gap: spacing.md }]}>
                <View style={styles.heroEyebrowRow}>
                  <Text variant="caption" color="secondary" style={styles.eyebrowText}>
                    {dateLabel}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: hasDue ? colors.brandTertiary : colors.successBright,
                        borderColor: hasDue ? colors.warningBright : colors.success,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      variant="micro"
                      style={{
                        color: hasDue ? colors.text : colors.onPrimary,
                        fontWeight: '700',
                      }}
                    >
                      {hasDue ? `★ ${dueCount} READY` : '★ ALL DONE!'}
                    </Text>
                  </View>
                </View>

                <Text
                  variant="heroTitle"
                  role="display"
                  style={{
                    fontSize: isWide ? 48 : 36,
                    lineHeight: isWide ? 58 : 45,
                  }}
                >
                  {hasDue
                    ? t('today.headlineDue', { count: dueCount })
                    : t('today.headlineNone')}
                </Text>
                {hasDue ? (
                  <Text variant="body" color="secondary" style={{ fontSize: 18, lineHeight: 28 }}>
                    {`${t('today.estimate', { minutes })}. ${t(mixKey)}`}
                  </Text>
                ) : null}
                <View style={[styles.ctaRow, { marginTop: spacing.xs }]}>
                  {hasDue ? (
                    <>
                      <Button
                        label={t('today.startReview')}
                        variant="primary"
                        size="hero"
                        iconLeft="play"
                        onPress={startReview}
                        hint={<Kbd color={colors.onPrimary}>Enter</Kbd>}
                      />
                      <Button
                        label={t('today.addWord')}
                        variant="secondary"
                        size="hero"
                        iconLeft="add-circle"
                        onPress={() => navigation.navigate('Add')}
                      />
                    </>
                  ) : (
                    <Button
                      label={t('today.addWord')}
                      variant="primary"
                      size="hero"
                      iconLeft="add-circle"
                      onPress={() => navigation.navigate('Add')}
                    />
                  )}
                </View>
              </View>
            </View>

            <View
              accessibilityLabel="Today at a glance"
              style={[
                styles.glanceStrip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.hairline,
                  borderRadius: radii.card,
                  flexDirection: isWide ? 'row' : 'column',
                },
                shadows.playful,
              ]}
            >
              <View
                style={[
                  styles.glanceCell,
                  isWide ? styles.glanceCellWideFirst : styles.glanceCellStacked,
                ]}
              >
                <Text variant="caption" color="secondary" style={styles.glanceLabel}>
                  {t('today.dailyGoal')}
                </Text>
                <View style={styles.statLine}>
                  <Text
                    variant="stat"
                    role="display"
                    tabular
                    style={[styles.statNumber, { color: colors.brandPrimary }]}
                  >
                    {xpToday}
                  </Text>
                  <Text variant="body" color="muted" tabular>
                    {`/ ${dailyGoalXp} XP`}
                  </Text>
                </View>
                <AnimatedProgressBar percent={goalPct} height={10} />
              </View>

              <View
                style={[
                  styles.glanceCell,
                  isWide
                    ? [styles.glanceCellWideMiddle, { borderLeftColor: colors.hairline }]
                    : [styles.glanceCellStacked, { borderTopWidth: 2, borderTopColor: colors.hairline }],
                ]}
              >
                <Text variant="caption" color="secondary" style={styles.glanceLabel}>
                  {t('today.streak')}
                </Text>
                <View style={styles.statLine}>
                  <Text
                    variant="stat"
                    role="display"
                    tabular
                    style={[styles.statNumber, { color: colors.warningBright }]}
                  >
                    {streakDays}
                  </Text>
                  <Text variant="body" color="muted">
                    {t('today.days')}
                  </Text>
                </View>
                <Text variant="caption" color="muted">
                  {t('today.freezesAvailable', { count: freezes })}
                </Text>
              </View>

              <View
                style={[
                  styles.glanceCell,
                  isWide
                    ? [styles.glanceCellWideLast, { borderLeftColor: colors.hairline }]
                    : [styles.glanceCellStacked, { borderTopWidth: 2, borderTopColor: colors.hairline }],
                ]}
              >
                <Text variant="caption" color="secondary" style={styles.glanceLabel}>
                  {t('today.inYourDecks')}
                </Text>
                <View style={styles.statLine}>
                  <Text
                    variant="stat"
                    role="display"
                    tabular
                    style={[styles.statNumber, { color: colors.brandSecondary }]}
                  >
                    {wordsTotal}
                  </Text>
                  <Text variant="body" color="muted">
                    {t('today.words')}
                  </Text>
                </View>
                <Text variant="caption" color="muted">
                  {nextReview
                    ? t('today.nextReview', { date: nextReview.date })
                    : t('today.nextReviewNone')}
                </Text>
              </View>
            </View>

            {upNext.length > 0 ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.hairline,
                    borderRadius: radii.card,
                    padding: isWide ? 24 : 20,
                    gap: spacing.md,
                  },
                  shadows.playful,
                ]}
              >
                <View style={styles.sectionHeader}>
                  <Text variant="sectionTitle" role="display">
                    {t('today.upNext')}
                  </Text>
                  <Pressable
                    onPress={() => navigation.navigate('Words')}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text variant="bodySmall" color="accent" style={{ fontWeight: '700' }}>
                      {t('today.seeAllWords')}
                    </Text>
                  </Pressable>
                </View>

                <View style={[styles.upNextList, { borderTopColor: colors.hairline }]}>
                  {upNext.map((item) => (
                    <View
                      key={item.user_word_sense_id}
                      style={[
                        styles.upNextRow,
                        { borderBottomColor: colors.divider },
                      ]}
                    >
                      <View
                        style={[
                          styles.upNextStageDot,
                          { backgroundColor: stageColor(item.learning_stage) },
                        ]}
                      />
                      <Text
                        variant="listLemma"
                        role="display"
                        style={styles.upNextLemma}
                      >
                        {item.lemma}
                      </Text>
                      {item.pronunciation ? (
                        <Text variant="ipa" role="mono" color="muted">
                          {item.pronunciation}
                        </Text>
                      ) : null}
                      {item.part_of_speech ? (
                        <View
                          style={[
                            styles.posPill,
                            {
                              backgroundColor: colors.infoSurface,
                              borderColor: colors.brandSecondary,
                              borderRadius: radii.full,
                            },
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={[styles.upNextPos, { color: colors.accent }]}
                          >
                            {item.part_of_speech}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>

                {remaining > 0 ? (
                  <Text variant="caption" color="muted">
                    {t('today.andMore', { count: remaining })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.hairline,
                  borderRadius: radii.card,
                  padding: isWide ? 24 : 20,
                  gap: spacing.md,
                },
                shadows.playful,
              ]}
            >
              <Text variant="sectionTitle" role="display">
                {t('today.mastery')}
              </Text>
              <MasteryBar stageCounts={stats.stage_counts} />
            </View>
          </View>
        )}
      </PageColumn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: 32,
  },
  heroCard: {
    borderWidth: 2,
    overflow: 'hidden',
  },
  heroInner: {},
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrowText: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 2,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  glanceStrip: {
    borderWidth: 2,
    overflow: 'hidden',
  },
  glanceCell: {
    flex: 1,
    gap: 10,
  },
  glanceLabel: {
    fontWeight: '700',
  },
  statNumber: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  glanceCellWideFirst: {
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  glanceCellWideMiddle: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderLeftWidth: 2,
  },
  glanceCellWideLast: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderLeftWidth: 2,
  },
  glanceCellStacked: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  sectionCard: {
    borderWidth: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  upNextList: {
    borderTopWidth: 2,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  upNextStageDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  upNextLemma: {
    minWidth: 150,
    fontSize: 22,
    lineHeight: 30,
  },
  posPill: {
    marginLeft: 'auto',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  upNextPos: {
    fontWeight: '700',
  },
});
