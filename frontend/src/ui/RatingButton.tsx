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
  backgroundColor: string;
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
          backgroundColor: option.backgroundColor,
          borderColor: option.color,
          borderRadius: radii.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityLabel={`${option.label} ${option.interval}`}
      accessibilityRole="button"
    >
      <View style={styles.content}>
        <Text variant="label" bold style={[styles.label, { color: option.color }]}>
          {option.label}
        </Text>
        <Text variant="caption" style={[styles.interval, { color: colors.onSurfaceVariant }]}>
          {option.interval}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    textAlign: 'center',
    fontSize: 15,
  },
  interval: {
    textAlign: 'center',
    fontSize: 12,
  },
});
