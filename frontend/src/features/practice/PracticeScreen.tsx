import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Screen, Text } from '../../ui';

export function PracticeScreen() {
  const { spacing } = useTheme();

  return (
    <Screen padded>
      <View style={[styles.center, { gap: spacing.sm }]}>
        <Text variant="title">Practice</Text>
        <Text muted>Coming soon — quizzes and reviews will live here.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
