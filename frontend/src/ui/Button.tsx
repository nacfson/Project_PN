import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radii } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary }
      : variant === 'secondary'
        ? { backgroundColor: colors.border }
        : variant === 'danger'
          ? { backgroundColor: colors.danger }
          : { backgroundColor: 'transparent' };

  const labelColor =
    variant === 'primary' || variant === 'danger'
      ? colors.surface
      : variant === 'secondary'
        ? colors.text
        : colors.primary;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        variantStyle,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text variant="label" style={{ color: labelColor, textAlign: 'center' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
