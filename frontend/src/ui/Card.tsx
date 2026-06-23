import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: 'filled' | 'outlined';
}

export function Card({ elevated, variant = 'filled', style, children, ...rest }: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variant === 'filled' ? colors.surfaceContainerLow : colors.surface,
          borderRadius: radii.xxl,
          padding: spacing.lg,
          borderColor: variant === 'outlined' ? colors.outlineVariant : 'transparent',
        },
        elevated ? shadows.md : shadows.none,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
