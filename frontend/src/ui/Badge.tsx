import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type BadgeVariant = 'default' | 'success' | 'danger' | 'primary';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default', style, ...rest }: BadgeProps) {
  const { colors, spacing, radii } = useTheme();

  const bgColor =
    variant === 'success'
      ? '#dcfce7'
      : variant === 'danger'
        ? '#fee2e2'
        : variant === 'primary'
          ? colors.primary
          : colors.border;

  const textColor =
    variant === 'primary' ? colors.surface : variant === 'success' ? colors.success : variant === 'danger' ? colors.danger : colors.text;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bgColor,
          borderRadius: radii.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="caption" style={{ color: textColor, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
});
