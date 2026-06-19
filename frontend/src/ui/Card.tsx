import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ elevated, style, children, ...rest }: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          padding: spacing.lg,
          borderColor: colors.border,
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
