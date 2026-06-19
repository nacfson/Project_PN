import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { mockProgress } from './mockProgress';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Icon, Screen, Text } from '../../ui';
import { getDueLearningItems } from '../../api/learningItems';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Learn'>;

export function HomeScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NavigationProp>();
  const { displayName, streakDays, xpToday, dailyGoalXp } = mockProgress;
  const [wordsDueToday, setWordsDueToday] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDueLearningItems()
        .then((items) => {
          if (active) {
            setWordsDueToday(items.length);
          }
        })
        .catch((err) => {
          console.error('Error fetching due items:', err);
          if (active) {
            setWordsDueToday(0);
          }
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const dueCount = wordsDueToday ?? 0;
  const hasDue = dueCount > 0;

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingVertical: spacing.lg, gap: spacing.lg }]}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">{t('home.greeting', { name: displayName })}</Text>
          <Text color="muted">{t('home.subtitle')}</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Practice')}
          style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
        >
          <Card elevated style={[styles.heroCard, { borderColor: hasDue ? colors.primary : colors.border }]}>
            <View style={styles.row}>
              <View style={styles.heroTitleRow}>
                <View style={[styles.heroIconCircle, { backgroundColor: hasDue ? colors.primary : colors.successSurface }]}>
                  <Icon name={hasDue ? 'layers' : 'checkmark-circle'} size="lg" color={hasDue ? colors.onPrimary : colors.success} />
                </View>
                <View>
                  <Text variant="title">{t('home.wordsDue')}</Text>
                  <Text variant="caption" color="muted">
                    {hasDue ? t('home.tapToStart') : t('home.allCaughtUp')}
                  </Text>
                </View>
              </View>
              <Badge
                label={wordsDueToday === null ? '...' : String(dueCount)}
                variant={hasDue ? 'primary' : 'success'}
              />
            </View>

            {wordsDueToday === null ? (
              <Text color="muted">{t('home.checkingDue')}</Text>
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
                variant="secondary"
                iconRight="arrow-forward"
                onPress={() => navigation.navigate('Practice')}
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>
        </Pressable>

        <View style={[styles.statsGrid, { gap: spacing.md }]}>
          <Card style={styles.statCard}>
            <View style={[styles.statIconCircle, { backgroundColor: colors.warningSurface }]}>
              <Icon name="flame" size="md" color={colors.warning} />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text variant="title">{streakDays}</Text>
              <Text variant="caption" color="muted">
                {t('home.dayStreak')}
              </Text>
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={[styles.statIconCircle, { backgroundColor: colors.infoSurface }]}>
              <Icon name="trophy" size="md" color={colors.info} />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text variant="title">
                {xpToday} / {dailyGoalXp}
              </Text>
              <Text variant="caption" color="muted">
                {t('home.xpToday')}
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
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
    borderWidth: 2,
    padding: 20,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
});
