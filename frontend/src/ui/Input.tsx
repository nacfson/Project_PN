import React, { forwardRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamilyFor } from '../theme/fonts';
import { Icon } from './Icon';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  onClear?: () => void;
  secureTextEntryToggle?: boolean;
  loading?: boolean;
  error?: boolean;
  helperText?: string;
  variant?: 'default' | 'display';
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
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
    variant = 'default',
    leading,
    trailing,
    ...rest
  },
  ref,
) {
  const { colors, spacing, radii, controlHeight, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [isHidden, setIsHidden] = useState(() =>
    secureTextEntryToggle ? true : secureTextEntry ?? false,
  );

  const showClear = !!(onClear && value && value.length > 0);
  const showLoading = !!loading;
  const effectiveSecureTextEntry = secureTextEntryToggle ? isHidden : secureTextEntry;
  const isMultiline = rest.multiline === true;
  const isDisplay = variant === 'display';
  const minHeight = isDisplay ? controlHeight.hero : controlHeight.buttonLg;

  const hasTrailing = showLoading || secureTextEntryToggle || showClear || Boolean(trailing);

  const borderColor = error
    ? colors.brandPrimary
    : focused
      ? colors.brandSecondary
      : colors.controlBorder;

  const fontStyle = isDisplay
    ? {
        fontSize: typography.tokens.inputDisplay.fontSize,
        lineHeight: typography.tokens.inputDisplay.lineHeight,
        fontFamily: fontFamilyFor('display', 'semibold', { text: value }),
      }
    : {
        fontSize: typography.tokens.body.fontSize,
        fontFamily: fontFamilyFor('ui', 'regular', { text: value }),
      };

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.wrapper,
          {
            minHeight: isMultiline ? undefined : minHeight,
            backgroundColor: error ? colors.dangerSurface : colors.surfaceBase,
            borderColor,
            borderWidth: 2,
            borderRadius: radii.md,
            alignItems: isMultiline ? 'stretch' : 'center',
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          },
          Platform.OS === 'web' && focused
            ? ({ outlineWidth: 4, outlineStyle: 'solid', outlineColor: colors.infoSurface } as unknown as ViewStyle)
            : null,
        ]}
      >
        {leading ? <View style={styles.slot}>{leading}</View> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={effectiveSecureTextEntry}
          style={[
            styles.input,
            {
              paddingVertical: isDisplay ? spacing.md : spacing.sm,
              color: colors.text,
            },
            fontStyle,
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
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
        {hasTrailing && (
          <View style={[styles.trailing, { gap: spacing.sm }]}>
            {showLoading && <ActivityIndicator size="small" color={colors.accent} />}
            {secureTextEntryToggle && (
              <Pressable onPress={() => setIsHidden((prev) => !prev)} hitSlop={8}>
                <Icon name={isHidden ? 'eye-outline' : 'eye-off-outline'} size="md" color={colors.textMuted} />
              </Pressable>
            )}
            {showClear && (
              <Pressable onPress={onClear} hitSlop={8}>
                <Icon name="close-circle" size="md" color={colors.textMuted} />
              </Pressable>
            )}
            {trailing}
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
});

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
