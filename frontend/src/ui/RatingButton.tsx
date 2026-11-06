import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Kbd } from './Kbd';
import { Text } from './Text';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type { RatingButtonProps };

interface RatingOption {
  rating: Rating;
  label: string;
  interval: string;
  shortcutKey?: string;
  compact?: boolean;
}

interface RatingButtonProps {
  option: RatingOption;
  onPress: (rating: Rating) => void;
  style?: StyleProp<ViewStyle>;
}

export function RatingButton({ option, onPress, style }: RatingButtonProps) {
  const { colors, radii, shadows } = useTheme();
  const isGood = option.rating === 'good';
  const isEasy = option.rating === 'easy';
  const isHard = option.rating === 'hard';
  const isAgain = option.rating === 'again';
  const showShortcut = Platform.OS === 'web' && !option.compact && Boolean(option.shortcutKey);

  const bg = isGood
    ? colors.successBright
    : isEasy
      ? colors.brandSecondary
      : isHard
        ? colors.surfaceHighlight
        : colors.dangerSurface;

  const border = isGood
    ? colors.success
    : isEasy
      ? colors.brandSecondaryDark
      : isHard
        ? colors.warningBright
        : colors.brandPrimary;

  const fg = isGood || isEasy ? colors.onPrimary : isHard ? colors.warning : colors.danger;

  return (
    <Pressable
      onPress={() => onPress(option.rating)}
      style={({ pressed }) => [
        styles.base,
        option.compact ? styles.baseCompact : styles.baseDesktop,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: radii.md,
          transform: [{ translateY: pressed ? 3 : 0 }],
        },
        shadows.playful,
        style,
      ]}
      accessibilityLabel={`${option.label} ${option.interval}`}
      accessibilityRole="button"
    >
      <View style={[styles.topRow, option.compact && styles.topRowCompact]}>
        <Text
          role="display"
          variant="label"
          style={[
            styles.label,
            { color: fg, fontWeight: '700', fontSize: 17 },
          ]}
        >
          {option.label}
        </Text>
        {showShortcut && option.shortcutKey ? (
          <Kbd color={isGood || isEasy ? colors.onPrimary : undefined}>{option.shortcutKey}</Kbd>
        ) : null}
      </View>
      <Text
        variant="caption"
        style={[
          styles.interval,
          {
            color: isAgain ? colors.danger : fg,
            opacity: isGood || isEasy ? 0.9 : 0.85,
            fontWeight: '600',
          },
        ]}
      >
        {option.interval}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
  },
  baseDesktop: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  baseCompact: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  topRowCompact: {
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  interval: {
    fontSize: 12,
  },
});
