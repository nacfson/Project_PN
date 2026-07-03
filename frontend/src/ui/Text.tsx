import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type TextVariant = 'body' | 'caption' | 'title' | 'heading' | 'headline' | 'label';
type TextColor = 'default' | 'muted' | 'inverse' | 'primary' | 'danger' | 'success' | 'onPrimaryContainer' | 'onSecondaryContainer';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  bold?: boolean;
}

const variantStylesFor = (sizes: typeof import('../theme/tokens').typography.sizes): Record<TextVariant, TextStyle> => ({
  body: { fontSize: sizes.md, lineHeight: 22, fontFamily: 'Inter-Regular' },
  caption: { fontSize: sizes.sm, lineHeight: 18, fontFamily: 'Inter-Medium', letterSpacing: 0.2 },
  title: { fontSize: sizes.lg, fontWeight: '700', lineHeight: 24, fontFamily: 'Inter-Bold', letterSpacing: -0.2 },
  heading: { fontSize: sizes.xl, fontWeight: '800', lineHeight: 28, fontFamily: 'Inter-ExtraBold', letterSpacing: -0.3 },
  headline: { fontSize: sizes.xxl, fontWeight: '900', lineHeight: 34, fontFamily: 'Inter-ExtraBold', letterSpacing: -0.5 },
  label: { fontSize: sizes.sm, fontWeight: '600', lineHeight: 18, fontFamily: 'Inter-SemiBold', letterSpacing: 0.4 },
});

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

  const variantStyles = variantStylesFor(typography.sizes);

  return (
    <RNText
      style={[
        { fontSize: typography.sizes.md, fontFamily: typography.fontFamily },
        variantStyles[variant],
        { color: colorMap[color] },
        bold && { fontWeight: typography.weights.bold },
        style,
      ]}
      {...rest}
    />
  );
}

