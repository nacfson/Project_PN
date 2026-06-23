import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default', style, ...rest }: BadgeProps) {
  const { colors, spacing, radii } = useTheme();

  const palette = {
    default: { bg: colors.surfaceContainerHighest, text: colors.onSurface },
    primary: { bg: colors.primaryContainer, text: colors.onPrimaryContainer },
    success: { bg: colors.successSurface, text: colors.success },
    warning: { bg: colors.warningSurface, text: colors.warning },
    danger: { bg: colors.errorContainer, text: colors.error },
    info: { bg: colors.infoSurface, text: colors.info },
  };

  const { bg, text } = palette[variant];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radii.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="caption" style={{ color: text, fontWeight: '600' }}>
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
