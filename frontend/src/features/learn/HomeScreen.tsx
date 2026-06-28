import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { me } from '../../api/auth';
import { getContentChallenges, getWordOfTheDay } from '../../api/content';
import { getStatsSummary } from '../../api/stats';
import { useAddQueue } from '../../hooks/useAddQueue';
import { useAppLanguage } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { ContentChallenge, SenseOption, StatsSummary } from '../../types';
import { recentCaptureWords } from '../../storage/captureHistory';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Screen, Text } from '../../ui';
import { AddWordModal } from '../../components/AddWordModal';
import { SkeletonCard } from '../../ui/SkeletonCard';
import { StaggeredList } from '../../ui/StaggeredList';
import { CinematicCard } from '../../ui/CinematicCard';
import { AnimatedProgressBar } from '../../ui/AnimatedProgressBar';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Learn'>;

const XP_PER_REVIEW = 10;

const MASTERY_STAGES = ['new', 'learning', 'recognized', 'recalled', 'usable', 'mastered'] as const;
type MasteryStage = (typeof MASTERY_STAGES)[number];

const STAGE_LABEL_KEYS: Record<MasteryStage, TranslationKey> = {
  new: 'home.stage.new',
  learning: 'home.stage.learning',
  recognized: 'home.stage.recognized',
  recalled: 'home.stage.recalled',
  usable: 'home.stage.usable',
  mastered: 'home.stage.mastered',
};

function displayNameFromEmail(email: string, fallback: string): string {
  const local = email.split('@')[0]?.trim();
  return local || fallback;
}

function MasteryBreakdown({
  stageCounts,
}: {
  stageCounts: StatsSummary['stage_counts'];
}) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();

  const segments = useMemo(() => {
    return MASTERY_STAGES.map((stage) => ({
      stage,
      count: stageCounts[stage] ?? 0,
    }));
  }, [stageCounts]);

  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) {
    return <Text color="muted">{t('home.masteryEmpty')}</Text>;
  }

  const stageColors: Record<MasteryStage, string> = {
    new: colors.surfaceContainerHighest,
    learning: colors.info,
    recognized: colors.primary,
    recalled: colors.warning,
    usable: colors.success,
    mastered: colors.secondary,
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.masteryBar, { borderRadius: radii.full, backgroundColor: colors.surfaceContainerHighest }]}>
        {segments.map((segment) => {
          if (segment.count === 0) {
            return null;
          }
          return (
            <View
              key={segment.stage}
              style={{
                flex: segment.count,
                backgroundColor: stageColors[segment.stage],
                minWidth: 4,
              }}
            />
          );
        })}
      </View>

      <View style={[styles.legendGrid, { gap: spacing.sm }]}>
        {segments.map((segment) => (
          <View key={segment.stage} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: stageColors[segment.stage] }]} />
            <Text variant="caption" color="muted">
              {t(STAGE_LABEL_KEYS[segment.stage])} · {segment.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ForecastChart({ forecast }: { forecast: StatsSummary['forecast'] }) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();

  const maxCount = Math.max(1, ...forecast.map((day) => day.count));

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.forecastChart, { gap: spacing.xs }]}>
        {forecast.map((day, index) => {
          const height = Math.max(4, Math.round((day.count / maxCount) * 72));
          const isToday = index === 0;
          return (
            <View key={day.date} style={styles.forecastColumn}>
              <View
                style={[
                  styles.forecastBar,
                  {
                    height,
                    borderRadius: radii.sm,
                    backgroundColor: isToday ? colors.primary : colors.secondary,
                    opacity: day.count === 0 ? 0.25 : 1,
                  },
                ]}
              />
              <Text variant="caption" color="muted" style={styles.forecastLabel}>
                {index === 0 ? t('home.forecastToday') : String(index + 1)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="caption" color="muted">
        {forecast.reduce((sum, day) => sum + day.count, 0)} {t('home.forecastTotal')}
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NavigationProp>();
  const { enqueue, enqueueMany } = useAddQueue();
  const [displayName, setDisplayName] = useState('Learner');
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [wordOfTheDay, setWordOfTheDay] = useState<SenseOption | null>(null);
  const [captureWords, setCaptureWords] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<ContentChallenge[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      Promise.all([getStatsSummary(), me(), getWordOfTheDay(), getContentChallenges(), recentCaptureWords()])
        .then(([summary, user, wotd, challengeResponse, recentCaptures]) => {
          if (!active) {
            return;
          }
          setStats(summary);
          setStatsError(false);
          setDisplayName(displayNameFromEmail(user.email, t('common.learner')));
          setWordOfTheDay(wotd.sense_options[0] ?? null);
          setChallenges(challengeResponse.challenges);
          setCaptureWords(recentCaptures);
        })
        .catch((err) => {
          console.error('Error fetching home stats:', err);
          if (active) {
            setStats(null);
            setStatsError(true);
          }
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const dueCount = stats?.due_today ?? null;
  const hasDue = dueCount !== null && dueCount > 0;
  const streakDays = stats?.review_streak_days ?? 0;
  const dailyGoalXP = stats?.daily_goal_xp ?? 200;
  const xpToday = (stats?.reviews_today ?? 0) * XP_PER_REVIEW;
  const streakAtRisk = stats?.streak_at_risk ?? false;
  const vacationModeActive = stats?.vacation_mode_active ?? false;
  const streakFreezeTokens = stats?.streak_freeze_tokens ?? 0;
  const longestStreak = stats?.longest_streak_days ?? 0;
  const totalWords = stats
    ? Object.values(stats.stage_counts).reduce((sum, count) => sum + count, 0)
    : null;

  const renderLoading = () => (
    <View style={{ gap: spacing.lg }}>
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
      <View style={[styles.statsGrid, { gap: spacing.md }]}>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </View>
    </View>
  );

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingVertical: spacing.lg }]}>
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="muted">
            {t('home.greeting', { name: displayName })}
          </Text>
          <Text variant="headline">{t('home.subtitle')}</Text>
        </View>

        <Button
          label={t('add.addWord')}
          iconLeft="add"
          variant="tonal"
          onPress={() => setAddModalVisible(true)}
          accessibilityLabel={t('add.addWord')}
        />

        {stats && streakAtRisk && hasDue ? (
          <Card style={{ borderColor: colors.warning, borderWidth: 1, gap: spacing.sm }}>
            <Text style={{ color: colors.warning }}>
              {t('home.streakAtRisk', { count: dueCount ?? 0, days: streakDays })}
            </Text>
          </Card>
        ) : null}

        {statsError || !stats ? renderLoading() : (
          <StaggeredList style={{ gap: spacing.lg }}>
            <CinematicCard
              elevated
              onPress={() => navigation.navigate('Practice')}
              style={[styles.heroCard, { backgroundColor: colors.primaryContainer, borderColor: 'transparent' }]}
              revealActions={
                <Icon name="arrow-forward" size="md" color={colors.onPrimaryContainer} />
              }
            >
              <View style={styles.row}>
                <View style={styles.heroTitleRow}>
                  <View style={[styles.heroIconCircle, { backgroundColor: colors.primary }]}>
                    <Icon name={hasDue ? 'school' : 'checkmark-circle'} size="lg" color={colors.onPrimary} />
                  </View>
                  <View>
                    <Text variant="caption" color="onPrimaryContainer">
                      {t('home.wordsDue')}
                    </Text>
                    <Text variant="title" color="onPrimaryContainer" bold>
                      {dueCount === null ? '...' : t('home.startReview', { count: dueCount })}
                    </Text>
                  </View>
                </View>
                <Badge
                  label={dueCount === null ? '...' : String(dueCount)}
                  variant={hasDue ? 'primary' : 'success'}
                />
              </View>

              {dueCount === null ? (
                <Text color="onPrimaryContainer">{t('home.checkingDue')}</Text>
              ) : hasDue ? (
                <Button
                  label={t('home.startReview', { count: dueCount })}
                  iconRight="arrow-forward"
                  onPress={() => navigation.navigate('Practice')}
                  style={{ marginTop: spacing.md }}
                />
              ) : (
                <Button
                  label={t('home.previewPractice')}
                  variant="outline"
                  iconRight="arrow-forward"
                  onPress={() => navigation.navigate('Practice')}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </CinematicCard>

            <View style={[styles.statsGrid, { gap: spacing.md }]}>
              <Card style={styles.statCard} onPress={() => navigation.navigate('Settings')}>
                <View style={[styles.statIconCircle, { backgroundColor: colors.tertiaryContainer }]}>
                  <Icon name="flame" size="md" color={colors.tertiary} />
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text variant="title" bold>
                    {stats ? streakDays : '...'}
                  </Text>
                  <Text variant="caption" color="muted">
                    {t('home.dayStreak')}
                  </Text>
                  {stats && vacationModeActive ? (
                    <Text variant="caption" color="muted">
                      {t('home.streakVacation')}
                    </Text>
                  ) : null}
                  {stats && !vacationModeActive && streakFreezeTokens > 0 ? (
                    <Text variant="caption" color="muted">
                      {t('home.streakFreezeAvailable', { count: streakFreezeTokens })}
                    </Text>
                  ) : null}
                  {stats && longestStreak > streakDays ? (
                    <Text variant="caption" color="muted">
                      {t('home.longestStreak', { days: longestStreak })}
                    </Text>
                  ) : null}
                </View>
              </Card>

              <Card style={styles.statCard} onPress={() => navigation.navigate('Words')}>
                <View style={[styles.statIconCircle, { backgroundColor: colors.secondaryContainer }]}>
                  <Icon name="book" size="md" color={colors.secondary} />
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text variant="title" bold>
                    {totalWords ?? '...'}
                  </Text>
                  <Text variant="caption" color="muted">
                    {t('tabs.words')}
                  </Text>
                </View>
              </Card>
            </View>

            <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
              <View style={styles.row}>
                <Text variant="title">{t('home.xpToday')}</Text>
                <Text variant="caption" color="primary" bold>
                  {Math.min(100, Math.round((xpToday / dailyGoalXP) * 100))}%
                </Text>
              </View>
              <AnimatedProgressBar percent={Math.min(100, Math.round((xpToday / dailyGoalXP) * 100))} />
              <Text variant="caption" color="muted">
                {xpToday} / {dailyGoalXP} XP
              </Text>
            </Card>

            {wordOfTheDay ? (
              <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
                <View style={styles.row}>
                  <View style={[styles.smallIconCircle, { backgroundColor: colors.tertiaryContainer }]}>
                    <Icon name="bulb" size="md" color={colors.tertiary} />
                  </View>
                  <Text variant="label" color="muted">
                    {t('home.wordOfTheDayTitle')}
                  </Text>
                </View>
                <Text variant="title" bold>
                  {wordOfTheDay.lemma}
                </Text>
                <Text color="muted">{wordOfTheDay.localized_definition || wordOfTheDay.definition}</Text>
                <Button
                  label={t('home.wordOfTheDayAdd')}
                  variant="tonal"
                  onPress={() => enqueue(wordOfTheDay.lemma, 'Any')}
                />
              </Card>
            ) : (
              <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
                <Text variant="title">{t('home.wordOfTheDayTitle')}</Text>
                <Text color="muted">{t('home.wordOfTheDayEmpty')}</Text>
              </Card>
            )}

            <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
              <Text variant="title">{t('home.captureReentryTitle')}</Text>
              <Text variant="caption" color="muted">
                {t('home.captureReentrySubtitle')}
              </Text>
              {captureWords.length > 0 ? (
                <>
                  <Text>{captureWords.join(', ')}</Text>
                  <Button
                    label={t('home.captureReentryAdd')}
                    variant="tonal"
                    onPress={() => enqueueMany(captureWords, 'Any')}
                  />
                </>
              ) : (
                <Text color="muted">{t('home.captureReentryEmpty')}</Text>
              )}
            </Card>

            {challenges.length > 0 ? (
              <Card style={{ gap: spacing.md, padding: spacing.lg }}>
                <Text variant="title">{t('home.challengesTitle')}</Text>
                {challenges.map((challenge) => (
                  <View key={challenge.id} style={{ gap: spacing.xs }}>
                    <Text>{challenge.title}</Text>
                    <Text variant="caption" color="muted">
                      {challenge.description}
                    </Text>
                    {challenge.status === 'coming_soon' ? (
                      <Badge label={t('home.challengesComingSoon')} variant="default" />
                    ) : null}
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: spacing.md, padding: spacing.lg }}>
              <Text variant="title">{t('home.progressTitle')}</Text>
              {statsError ? (
                <Text color="muted">{t('home.statsLoadFailed')}</Text>
              ) : stats ? (
                <>
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="caption" color="muted">
                      {t('home.masteryTitle')}
                    </Text>
                    <MasteryBreakdown stageCounts={stats.stage_counts} />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <Text variant="caption" color="muted">
                      {t('home.forecastTitle')}
                    </Text>
                    <ForecastChart forecast={stats.forecast} />
                  </View>
                </>
              ) : (
                <Text color="muted">{t('home.checkingDue')}</Text>
              )}
            </Card>
          </StaggeredList>
        )}
      </View>
      </ScrollView>

      <AddWordModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdded={() => setAddModalVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCard: {
    padding: 20,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masteryBar: {
    flexDirection: 'row',
    overflow: 'hidden',
    height: 12,
    width: '100%',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '45%',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  forecastChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 96,
  },
  forecastColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  forecastBar: {
    width: '80%',
    minHeight: 4,
  },
  forecastLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
});
