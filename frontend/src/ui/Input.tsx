import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

interface InputProps extends TextInputProps {
  onClear?: () => void;
}

export function Input({ style, placeholderTextColor, onClear, value, onChangeText, ...rest }: InputProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const showClear = onClear && value && value.length > 0;

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.surface,
          borderColor: focused ? colors.primary : colors.border,
          borderRadius: radii.md,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.input,
          {
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: typography.sizes.md,
            color: colors.text,
          },
          style,
        ]}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
      />
      {showClear && (
        <Pressable onPress={onClear} style={styles.clear} hitSlop={8}>
          <Icon name="close-circle" size="md" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  input: {
    flex: 1,
  },
  clear: {
    paddingRight: 12,
  },
});
