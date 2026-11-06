import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  // Legacy aliases kept for compatibility
  | 'default'
  | 'primary'
  | 'info';

export interface BadgeProps extends ViewProps {
  label?: string;
  variant?: BadgeVariant;
  children?: React.ReactNode;
}

export function Badge({ label, variant = 'neutral', children, style, ...rest }: BadgeProps) {
  const { colors, spacing, radii } = useTheme();

  const normalized =
    variant === 'default'
      ? 'neutral'
      : variant === 'primary' || variant === 'info'
        ? 'accent'
        : variant;

  const palette = {
    neutral: { bg: colors.fill, text: colors.textSecondary },
    accent: { bg: colors.infoSurface, text: colors.accent },
    success: { bg: colors.successSurface, text: colors.success },
    warning: { bg: colors.warningSurface, text: colors.warning },
    danger: { bg: colors.dangerSurface, text: colors.danger },
  };

  const { bg, text } = palette[normalized];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radii.kbd,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
        style,
      ]}
      {...rest}
    >
      {children ? (
        children
      ) : (
        <Text variant="micro" style={{ color: text, fontWeight: '500' }}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
});
