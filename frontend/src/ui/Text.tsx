import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type TextVariant = 'body' | 'caption' | 'title' | 'heading' | 'headline' | 'label';
type TextColor = 'default' | 'muted' | 'inverse' | 'primary' | 'danger' | 'success' | 'onPrimaryContainer' | 'onSecondaryContainer';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  bold?: boolean;
}

export function Text({ variant = 'body', color = 'default', bold, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();

  const colorMap = {
    default: colors.onSurface,
    muted: colors.onSurfaceVariant,
    inverse: colors.inverseOnSurface,
    primary: colors.primary,
    danger: colors.error,
    success: colors.success,
    onPrimaryContainer: colors.onPrimaryContainer,
    onSecondaryContainer: colors.onSecondaryContainer,
  };

  return (
    <RNText
      style={[
        styles.base,
        variantStyles[variant],
        { color: colorMap[color] },
        bold && { fontWeight: typography.weights.bold },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 15,
  },
});

const variantStyles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  heading: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  headline: { fontSize: 28, fontWeight: '400', lineHeight: 36 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
