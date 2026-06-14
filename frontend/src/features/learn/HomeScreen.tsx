import { ScrollView, StyleSheet, View } from 'react-native';
import { mockProgress } from './mockProgress';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Card, Screen, Text } from '../../ui';

export function HomeScreen() {
  const { spacing } = useTheme();
  const { displayName, streakDays, xpToday, dailyGoalXp, wordsDueToday } = mockProgress;

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

        <Card>
          <View style={styles.row}>
            <Text variant="title">Words due today</Text>
            <Badge label={String(wordsDueToday)} variant="default" />
          </View>
          <Text muted style={{ marginTop: spacing.sm }}>
            Head to Practice when quizzes are ready.
          </Text>
        </Card>
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
});
