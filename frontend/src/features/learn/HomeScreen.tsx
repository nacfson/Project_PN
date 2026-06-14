import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { mockProgress } from './mockProgress';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Card, Screen, Text } from '../../ui';
import { getDueLearningItems } from '../../api/learningItems';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Learn'>;

export function HomeScreen() {
  const { spacing } = useTheme();
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

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingVertical: spacing.lg, gap: spacing.lg }]}>
        <View>
          <Text variant="heading">Hello, {displayName}</Text>
          <Text muted style={{ marginTop: spacing.xs }}>
            Ready to keep your streak going?
          </Text>
        </View>

        <Card>
          <View style={styles.row}>
            <Text variant="title">Streak</Text>
            <Badge label={`${streakDays} days`} variant="primary" />
          </View>
          <Text muted style={{ marginTop: spacing.sm }}>
            Keep reviewing daily to maintain your streak.
          </Text>
        </Card>

        <Card>
          <View style={styles.row}>
            <Text variant="title">XP today</Text>
            <Badge label={`${xpToday} / ${dailyGoalXp}`} variant="success" />
          </View>
          <Text muted style={{ marginTop: spacing.sm }}>
            {dailyGoalXp - xpToday} XP left to hit your daily goal.
          </Text>
        </Card>

        <Pressable onPress={() => navigation.navigate('Practice')}>
          <Card style={styles.clickableCard}>
            <View style={styles.row}>
              <Text variant="title">Words due today</Text>
              <Badge
                label={wordsDueToday === null ? '...' : String(wordsDueToday)}
                variant={wordsDueToday !== null && wordsDueToday > 0 ? 'primary' : 'default'}
              />
            </View>
            <Text muted style={{ marginTop: spacing.sm }}>
              {wordsDueToday === null
                ? 'Checking for due cards...'
                : wordsDueToday > 0
                  ? 'Tap to start reviewing your due cards!'
                  : 'All caught up! No cards due for review.'}
            </Text>
          </Card>
        </Pressable>
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
  },
  clickableCard: {
    cursor: 'pointer',
  },
});
