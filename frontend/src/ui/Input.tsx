import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Input({ style, placeholderTextColor, ...rest }: TextInputProps) {
  const { colors, spacing, radii, typography } = useTheme();

  return (
    <TextInput
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          fontSize: typography.sizes.md,
          color: colors.text,
        },
        style,
      ]}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
