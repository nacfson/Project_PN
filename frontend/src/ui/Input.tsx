import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

interface InputProps extends TextInputProps {
  onClear?: () => void;
  secureTextEntryToggle?: boolean;
  loading?: boolean;
  error?: boolean;
  helperText?: string;
}

export function Input({
  style,
  placeholderTextColor,
  onClear,
  value,
  onChangeText,
  secureTextEntryToggle,
  secureTextEntry,
  loading,
  error,
  helperText,
  ...rest
}: InputProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [isHidden, setIsHidden] = useState(() => (secureTextEntryToggle ? true : secureTextEntry ?? false));

  const showClear = onClear && value && value.length > 0;
  const showLoading = loading;
  const effectiveSecureTextEntry = secureTextEntryToggle ? isHidden : secureTextEntry;
  const trailingCount = (showLoading ? 1 : 0) + (secureTextEntryToggle ? 1 : 0) + (showClear ? 1 : 0);
  const inputPaddingRight = trailingCount > 0 ? spacing.xxxl + trailingCount * spacing.xl : spacing.lg;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
            borderRadius: radii.md,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={effectiveSecureTextEntry}
          style={[
            styles.input,
            {
              paddingLeft: spacing.lg,
              paddingRight: inputPaddingRight,
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
        {trailingCount > 0 && (
          <View style={[styles.trailing, { gap: spacing.sm, paddingRight: spacing.md }]}>
            {showLoading && <ActivityIndicator size="small" color={colors.primary} />}
            {secureTextEntryToggle && (
              <Pressable onPress={() => setIsHidden((prev) => !prev)} hitSlop={8}>
                <Icon name={isHidden ? 'eye-outline' : 'eye-off-outline'} size="md" />
              </Pressable>
            )}
            {showClear && (
              <Pressable onPress={onClear} hitSlop={8}>
                <Icon name="close-circle" size="md" />
              </Pressable>
            )}
          </View>
        )}
      </View>
      {helperText ? (
        <Text variant="caption" color={error ? 'danger' : 'muted'} style={{ marginTop: spacing.xs }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  input: {
    flex: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    height: '100%',
  },
});
