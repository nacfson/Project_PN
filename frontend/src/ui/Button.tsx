import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  iconLeft?: React.ComponentProps<typeof Icon>['name'];
  iconRight?: React.ComponentProps<typeof Icon>['name'];
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  haptic?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  iconLeft,
  iconRight,
  style,
  fullWidth,
  haptic = true,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radii } = useTheme();
  const isDisabled = disabled || loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 6,
      useNativeDriver: true,
    }).start();
    if (haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary }
      : variant === 'secondary'
        ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant }
        : variant === 'tonal'
          ? { backgroundColor: colors.secondaryContainer }
          : variant === 'outline'
            ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.outline }
            : variant === 'danger'
              ? { backgroundColor: colors.error }
              : { backgroundColor: 'transparent' };

  const labelColor: React.ComponentProps<typeof Text>['color'] =
    variant === 'primary'
      ? 'inverse'
      : variant === 'danger'
        ? 'inverse'
        : variant === 'tonal'
          ? 'onSecondaryContainer'
          : variant === 'outline' || variant === 'ghost'
            ? 'primary'
            : 'default';

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <Pressable
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.full,
            opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
          },
          variantStyle,
        ]}
        {...rest}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={labelColor === 'inverse' ? colors.onPrimary : colors.primary} />
          ) : (
            <>
              {iconLeft && (
                <Icon
                  name={iconLeft}
                  size="sm"
                  color={labelColor === 'inverse' ? colors.onPrimary : colors.primary}
                />
              )}
              <Text variant="label" color={labelColor} style={{ textAlign: 'center' }} numberOfLines={1}>
                {label}
              </Text>
              {iconRight && (
                <Icon
                  name={iconRight}
                  size="sm"
                  color={labelColor === 'inverse' ? colors.onPrimary : colors.primary}
                />
              )}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
});
