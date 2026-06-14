import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type TextVariant = 'body' | 'caption' | 'title' | 'heading' | 'label';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  muted?: boolean;
  bold?: boolean;
}

export function Text({ variant = 'body', muted, bold, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();

  return (
    <RNText
      style={[
        styles.base,
        variantStyles[variant],
        { color: muted ? colors.textMuted : colors.text },
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
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  title: { fontSize: 18, fontWeight: '600' },
  heading: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
});
