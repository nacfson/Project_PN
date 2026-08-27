import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { me } from '../../api/auth';
import { getStatsSummary } from '../../api/stats';
import { useAppLanguage } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { StatsSummary } from '../../types';
import { useTheme, type ThemeVariation } from '../../theme/ThemeProvider';
import { Badge, Button, Card, ErrorState, Icon, Screen, Text } from '../../ui';
import { SkeletonCard } from '../../ui/SkeletonCard';
import { StaggeredList } from '../../ui/StaggeredList';
import { CinematicCard } from '../../ui/CinematicCard';
import { AnimatedProgressBar } from '../../ui/AnimatedProgressBar';
import { CountUpText } from '../../components/CountUpText';
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function displayNameFromEmail(email: string, fallback: string): string {
  const local = email.split('@')[0]?.trim();
  return local || fallback;
}

function MasteryBreakdown({
  stageCounts,
}: {
  stageCounts: StatsSummary['stage_counts'];
}) {
  const { colors, spacing, radii, motion, reduced } = useTheme();
  const { t } = useAppLanguage();
  const growAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      growAnim.setValue(1);
      return;
    }
    growAnim.setValue(0);
    const anim = Animated.spring(growAnim, {
      toValue: 1,
      ...motion.spring.bouncy,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [stageCounts, reduced, motion.spring.bouncy, growAnim]);

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
        <Animated.View
          style={{
            flexDirection: 'row',
            width: growAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            height: '100%',
          }}
        >
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
        </Animated.View>
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

function ForecastTooltip({
  day,
  index,
  colors,
  spacing,
  radii,
  t,
  onClose,
}: {
  day: StatsSummary['forecast'][number];
  index: number;
  colors: any;
  spacing: any;
  radii: any;
  t: any;
  onClose: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [index, scaleAnim]);

  const formattedDate = new Date(day.date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Animated.View
      testID="forecast-tooltip"
      style={[
        styles.tooltipContainer,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
          borderRadius: radii.md,
          padding: spacing.sm,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.tooltipHeader}>
        <Text variant="caption" bold style={{ color: colors.onSurface }}>
          {index === 0 ? `${t('home.forecastToday')} (${formattedDate})` : formattedDate}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} testID="tooltip-close-btn">
          <Text variant="caption" color="muted" style={{ paddingLeft: spacing.xs, fontSize: 12 }}>✕</Text>
        </Pressable>
      </View>
      <Text variant="caption" style={{ color: colors.primary, marginTop: 2 }}>
        {day.count} {day.count === 1 ? 'review' : 'reviews'} scheduled
      </Text>
    </Animated.View>
  );
}

function ForecastChart({ forecast }: { forecast: StatsSummary['forecast'] }) {
  const { colors, spacing, radii, motion, reduced } = useTheme();
  const { t } = useAppLanguage();
  const maxCount = Math.max(1, ...forecast.map((day) => day.count));
  const animValues = useRef<Animated.Value[]>([]);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number | null>(null);

  if (animValues.current.length !== forecast.length) {
    animValues.current = forecast.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    if (reduced) {
      animValues.current.forEach((val) => val.setValue(1));
      return;
    }
    animValues.current.forEach((val) => val.setValue(0));
    const animations = animValues.current.map((val) =>
      Animated.spring(val, {
        toValue: 1,
        ...motion.spring.bouncy,
        useNativeDriver: false,
      })
    );
    const composite = Animated.stagger(50, animations);
    composite.start();
    return () => {
      composite.stop();
    };
  }, [forecast, reduced, motion.spring.bouncy]);

  return (
    <View style={{ gap: spacing.sm, position: 'relative' }} testID="forecast-spline-chart">
      {activeNodeIndex !== null && forecast[activeNodeIndex] && (
        <ForecastTooltip
          day={forecast[activeNodeIndex]}
          index={activeNodeIndex}
          colors={colors}
          spacing={spacing}
          radii={radii}
          t={t}
          onClose={() => setActiveNodeIndex(null)}
        />
      )}
      <View style={[styles.forecastChart, { gap: spacing.xs, marginTop: activeNodeIndex !== null ? 24 : 0 }]}>
        {forecast.map((day, index) => {
          const height = Math.max(4, Math.round((day.count / maxCount) * 72));
          const isToday = index === 0;
          const isSelected = activeNodeIndex === index;
          return (
            <Pressable
              key={day.date}
              style={[styles.forecastColumn, isSelected && { transform: [{ scale: 1.05 }] }]}
              onPress={() => setActiveNodeIndex(isSelected ? null : index)}
              testID={`forecast-node-${index}`}
            >
              <Animated.View
                style={[
                  styles.splineDot,
                  {
                    backgroundColor: isToday ? colors.accent : colors.primary,
                    opacity: animValues.current[index] || 1,
                    transform: [
                      {
                        scale: animValues.current[index]
                          ? animValues.current[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.1, isSelected ? 1.3 : 1],
                            })
                          : isSelected ? 1.3 : 1,
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.forecastBar,
                  {
                    height: animValues.current[index]
                      ? animValues.current[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, height],
                        })
                      : height,
                    borderRadius: radii.sm,
                    backgroundColor: isToday ? colors.primary : colors.secondary,
                    opacity: isSelected ? 0.95 : day.count === 0 ? 0.15 : 0.6,
                  },
                ]}
              />
              <Text variant="caption" color="muted" style={styles.forecastLabel}>
                {index === 0 ? t('home.forecastToday') : String(index + 1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" color="muted">
        {forecast.reduce((sum, day) => sum + day.count, 0)} {t('home.forecastTotal')}
      </Text>
    </View>
  );
}

function XpDetailsBubble({
  percent,
  remaining,
  colors,
  spacing,
  radii,
}: {
  percent: number;
  remaining: number;
  colors: any;
  spacing: any;
  radii: any;
}) {
  const scaleBubble = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(scaleBubble, {
      toValue: 1,
      tension: 160,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleBubble]);

  return (
    <Animated.View
      testID="xp-details-bubble"
      style={[
        styles.xpBubbleContainer,
        {
          backgroundColor: colors.surfaceContainerHighest,
          borderColor: colors.outlineVariant,
          borderRadius: radii.md,
          padding: spacing.sm,
          transform: [{ scale: scaleBubble }],
        },
      ]}
    >
      <Text variant="caption" bold style={{ color: colors.onSurface }}>
        {percent >= 100 ? 'Daily goal complete! 🌟' : 'Daily Goal Progress'}
      </Text>
      <Text variant="caption" color="muted" style={{ marginTop: 2, textAlign: 'center' }}>
        {percent >= 100
          ? 'Keep learning to level up further.'
          : `${remaining} XP remaining to reach daily target.`}
      </Text>
    </Animated.View>
  );
}

function XpProgressOrb({ xpToday, dailyGoalXP }: { xpToday: number; dailyGoalXP: number }) {
  const { colors, spacing, radii, reduced } = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    );
    rotate.start();
    return () => rotate.stop();
  }, [rotateAnim]);

  useEffect(() => {
    if (reduced) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, reduced]);

  useEffect(() => {
    if (showDetails) {
      const timer = setTimeout(() => setShowDetails(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showDetails]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePress = () => {
    if (reduced) {
      setShowDetails((prev) => !prev);
      return;
    }
    setShowDetails(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 180, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  const percent = Math.min(100, Math.round((xpToday / dailyGoalXP) * 100));
  const remaining = Math.max(0, dailyGoalXP - xpToday);

  return (
    <Pressable onPress={handlePress} style={{ width: '100%' }}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
        <Card glass={true} testID="xp-progress-orb" style={[styles.orbCard, { position: 'relative' }]}>
          <Text variant="title" bold style={{ marginBottom: spacing.xs }}>XP Progress</Text>
          <View style={styles.orbContainer}>
            <Animated.View
              style={[
                styles.orbOuterRing,
                {
                  borderColor: colors.primary,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Animated.View style={[styles.orbGlass, { transform: [{ rotate: rotation }] }]}>
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  style={styles.orbGlow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </Animated.View>
              <View style={styles.orbInnerContent}>
                <Text variant="headline" bold style={{ color: colors.text }}>{percent}%</Text>
                <Text variant="caption" color="muted">{xpToday} / {dailyGoalXP} XP</Text>
              </View>
            </Animated.View>
          </View>

          {showDetails && (
            <XpDetailsBubble
              percent={percent}
              remaining={remaining}
              colors={colors}
              spacing={spacing}
              radii={radii}
            />
          )}
        </Card>
      </Animated.View>
    </Pressable>
  );
}

export function HomeScreen() {
  const { colors, spacing, radii, motion, reduced, variation, setVariation } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NavigationProp>();
  const [displayName, setDisplayName] = useState('Learner');
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const flameScale = useRef(new Animated.Value(1)).current;
  const bookScale = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(1)).current;

  const fetchHomeData = useCallback((activeRef?: { current: boolean }) => {
    return Promise.all([getStatsSummary(), me()])
      .then(([summary, user]) => {
        if (activeRef && !activeRef.current) return;
        setStats(summary);
        setStatsError(false);
        setDisplayName(displayNameFromEmail(user.email, t('common.learner')));
      })
      .catch((err) => {
        console.error('Error fetching home stats:', err);
        if (activeRef && !activeRef.current) return;
        setStats(null);
        setStatsError(true);
      });
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      const active = { current: true };
      void fetchHomeData(active);
      return () => {
        active.current = false;
      };
    }, [fetchHomeData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHomeData().finally(() => {
      setRefreshing(false);
    });
  }, [fetchHomeData]);

  const handleRetry = useCallback(() => {
    setStats(null);
    setStatsError(false);
    void fetchHomeData();
  }, [fetchHomeData]);

  const handlePressFlame = useCallback(() => {
    if (reduced) {
      navigation.navigate('Settings');
      return;
    }
    flameScale.setValue(motion.scale.press);
    Animated.spring(flameScale, {
      toValue: 1.0,
      tension: motion.spring.bouncy.tension,
      friction: motion.spring.bouncy.friction,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Settings');
    });
  }, [reduced, motion, navigation, flameScale]);

  const handlePressBook = useCallback(() => {
    if (reduced) {
      navigation.navigate('Words');
      return;
    }
    bookScale.setValue(motion.scale.press);
    Animated.spring(bookScale, {
      toValue: 1.0,
      tension: motion.spring.bouncy.tension,
      friction: motion.spring.bouncy.friction,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Words');
    });
  }, [reduced, motion, navigation, bookScale]);

  const handlePressHero = useCallback(() => {
    if (reduced) {
      navigation.navigate('Practice', { origin: 'private' });
      return;
    }
    heroScale.setValue(motion.scale.press);
    Animated.spring(heroScale, {
      toValue: 1.0,
      tension: motion.spring.bouncy.tension,
      friction: motion.spring.bouncy.friction,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Practice', { origin: 'private' });
    });
  }, [reduced, motion, navigation, heroScale]);

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

  const variations: { key: ThemeVariation; label: string }[] = [
    { key: 'bentoIndigo', label: 'Indigo Glow' },
    { key: 'bentoSunset', label: 'Sunset Gold' },
    { key: 'bentoLight', label: 'Light Mode' },
  ];

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
    <Screen
      title="Learn"
      padded
      contentContainerStyle={[styles.scroll, { paddingVertical: spacing.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
        />
      }
    >
      <View style={{ gap: spacing.lg }}>
        <View style={styles.headerRow}>
          <View style={{ gap: spacing.xs, flex: 1 }}>
            <Text variant="caption" color="muted">
              {t('home.greeting', { name: displayName })}
            </Text>
            <Text variant="headline">{t('home.subtitle')}</Text>
          </View>
          <Button
            label={t('add.addWord')}
            iconLeft="add"
            variant="tonal"
            onPress={() => navigation.navigate('Add')}
            accessibilityLabel={t('add.addWord')}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="muted" style={{ paddingHorizontal: 4 }}>
            Theme Variations
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.switcherContent, { gap: spacing.sm }]}
            style={styles.switcherScroll}
          >
            {variations.map((v) => (
              <Pressable
                key={v.key}
                onPress={() => setVariation(v.key)}
                style={[
                  styles.switcherChip,
                  {
                    backgroundColor: variation === v.key ? colors.primary : colors.surfaceGlass,
                    borderColor: colors.outlineVariant,
                    borderRadius: radii.md,
                    paddingVertical: spacing.xs + 2,
                    paddingHorizontal: spacing.md,
                  }
                ]}
              >
                <Text
                  style={{
                    color: variation === v.key ? colors.onPrimary : colors.textMuted,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {stats && streakAtRisk && hasDue ? (
          <Card glass={true} style={{ borderColor: colors.warning, borderWidth: 1, gap: spacing.sm }}>
            <Text style={{ color: colors.warning }}>
              {t('home.streakAtRisk', { count: dueCount ?? 0, days: streakDays })}
            </Text>
          </Card>
        ) : null}

        {statsError ? (
          <ErrorState
            message={t('home.statsLoadFailed')}
            onRetry={handleRetry}
          />
        ) : !stats ? (
          renderLoading()
        ) : (
          <View testID="bento-grid-container" style={[styles.bentoContainer, { gap: spacing.md }]}>
            <View style={styles.bentoColumnLeft}>
              <AnimatedPressable
                style={{ transform: [{ scale: heroScale }] }}
                onPress={handlePressHero}
                accessibilityRole="button"
              >
                <CinematicCard
                  elevated
                  testID="hero-bento-card"
                  style={[styles.heroCard, { padding: 0, overflow: 'hidden', borderColor: 'transparent', borderRadius: radii.xl }]}
                  revealActions={
                    <Icon name="arrow-forward" size="md" color="#ffffff" />
                  }
                >
                  <LinearGradient
                    colors={[colors.primary, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 20 }}
                  >
                    <View style={styles.row}>
                      <View style={styles.heroTitleRow}>
                        <View style={[styles.heroIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                          <Icon name={hasDue ? 'school' : 'checkmark-circle'} size="lg" color="#ffffff" />
                        </View>
                        <View>
                          <Text variant="caption" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            {t('home.wordsDue')}
                          </Text>
                          <Text variant="title" style={{ color: '#ffffff' }} bold>
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
                      <Text style={{ color: '#ffffff', marginTop: spacing.md }}>{t('home.checkingDue')}</Text>
                    ) : hasDue ? (
                      <Button
                        label={t('home.startReview', { count: dueCount })}
                        iconRight="arrow-forward"
                        variant="secondary"
                        onPress={handlePressHero}
                        style={{ marginTop: spacing.md }}
                      />
                    ) : (
                      <Button
                        label={t('home.previewPractice')}
                        variant="secondary"
                        iconRight="arrow-forward"
                        onPress={handlePressHero}
                        style={{ marginTop: spacing.md }}
                      />
                    )}
                  </LinearGradient>
                </CinematicCard>
              </AnimatedPressable>

              <XpProgressOrb xpToday={xpToday} dailyGoalXP={dailyGoalXP} />
            </View>

            <View style={styles.bentoColumnRight}>
              <View style={[styles.statsGrid, { gap: spacing.md }]}>
                <AnimatedPressable
                  style={{ flex: 1, transform: [{ scale: flameScale }] }}
                  onPress={handlePressFlame}
                  accessibilityRole="button"
                >
                  <Card glass={true} style={styles.statCard}>
                    <View style={[styles.statIconCircle, { backgroundColor: colors.tertiaryContainer }]}>
                      <Icon name="flame" size="md" color={colors.tertiary} />
                    </View>
                    <View style={{ gap: spacing.xs, flex: 1 }}>
                      {stats ? (
                        <CountUpText target={streakDays} variant="title" bold />
                      ) : (
                        <Text variant="title" bold>...</Text>
                      )}
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
                </AnimatedPressable>

                <AnimatedPressable
                  style={{ flex: 1, transform: [{ scale: bookScale }] }}
                  onPress={handlePressBook}
                  accessibilityRole="button"
                >
                  <Card glass={true} style={styles.statCard}>
                    <View style={[styles.statIconCircle, { backgroundColor: colors.secondaryContainer }]}>
                      <Icon name="book" size="md" color={colors.secondary} />
                    </View>
                    <View style={{ gap: spacing.xs, flex: 1 }}>
                      {totalWords !== null ? (
                        <CountUpText target={totalWords} variant="title" bold />
                      ) : (
                        <Text variant="title" bold>...</Text>
                      )}
                      <Text variant="caption" color="muted">
                        {t('tabs.words')}
                      </Text>
                    </View>
                  </Card>
                </AnimatedPressable>
              </View>

              <Card glass={true} style={{ gap: spacing.md, padding: spacing.lg }}>
                <Text variant="title">{t('home.forecastTitle')}</Text>
                <ForecastChart forecast={stats.forecast} />
              </Card>

              <Card glass={true} style={{ gap: spacing.md, padding: spacing.lg }}>
                <Text variant="title">{t('home.progressTitle')}</Text>
                <View style={{ gap: spacing.xs }}>
                  <Text variant="caption" color="muted">
                    {t('home.masteryTitle')}
                  </Text>
                  <MasteryBreakdown stageCounts={stats.stage_counts} />
                </View>
              </Card>
            </View>
          </View>
        )}
      </View>
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
  tooltipContainer: {
    position: 'absolute',
    top: -56,
    left: '5%',
    right: '5%',
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switcherScroll: {
    flexGrow: 0,
  },
  switcherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switcherChip: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  bentoColumnLeft: {
    flex: 1,
    minWidth: 280,
    gap: 16,
  },
  bentoColumnRight: {
    flex: 1.2,
    minWidth: 320,
    gap: 16,
  },
  xpBubbleContainer: {
    position: 'absolute',
    bottom: -64,
    left: '5%',
    right: '5%',
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCard: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  orbOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  orbGlass: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlow: {
    width: '120%',
    height: '120%',
    opacity: 0.18,
    borderRadius: 90,
  },
  orbInnerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
});
