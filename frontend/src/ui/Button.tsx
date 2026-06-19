import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  iconLeft?: React.ComponentProps<typeof Icon>['name'];
  iconRight?: React.ComponentProps<typeof Icon>['name'];
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  iconLeft,
  iconRight,
  style,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radii } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary }
      : variant === 'secondary'
        ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
        : variant === 'danger'
          ? { backgroundColor: colors.danger }
          : { backgroundColor: 'transparent' };

  const labelColor: 'inverse' | 'default' | 'danger' | 'primary' =
    variant === 'primary' || variant === 'danger'
      ? 'inverse'
      : variant === 'ghost'
        ? 'primary'
        : 'default';

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
        },
        variantStyle,
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={labelColor === 'inverse' ? colors.onPrimary : colors.primary} />
        ) : (
          <>
            {iconLeft && <Icon name={iconLeft} size="sm" color={labelColor === 'inverse' ? colors.onPrimary : colors.primary} />}
            <Text variant="label" color={labelColor} style={{ textAlign: 'center' }}>
              {label}
            </Text>
            {iconRight && <Icon name={iconRight} size="sm" color={labelColor === 'inverse' ? colors.onPrimary : colors.primary} />}
          </>
        )}
      </View>
    </Pressable>
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
});
