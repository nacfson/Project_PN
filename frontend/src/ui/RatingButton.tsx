import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type { RatingButtonProps };

interface RatingOption {
  rating: Rating;
  label: string;
  interval: string;
  color: string;
}

interface RatingButtonProps {
  option: RatingOption;
  onPress: (rating: Rating) => void;
  style?: StyleProp<ViewStyle>;
}

export function RatingButton({ option, onPress, style }: RatingButtonProps) {
  const { colors, spacing, radii } = useTheme();

  return (
    <Pressable
      onPress={() => onPress(option.rating)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? colors.surfaceContainerHighest : colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
          borderRadius: radii.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
      accessibilityLabel={`${option.label} ${option.interval}`}
      accessibilityRole="button"
    >
      <View style={styles.content}>
        <View style={[styles.accent, { backgroundColor: option.color }]} />
        <View style={styles.copy}>
          <Text variant="label" bold style={[styles.label, { color: colors.onSurface }]}>
            {option.label}
          </Text>
          <Text variant="caption" style={[styles.interval, { color: colors.onSurfaceVariant }]}>
            {option.interval}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 58,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  accent: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  label: {
    textAlign: 'left',
    fontSize: 15,
  },
  interval: {
    textAlign: 'left',
    fontSize: 12,
  },
});
