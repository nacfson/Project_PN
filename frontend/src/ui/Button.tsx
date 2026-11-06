import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'link'
  // Legacy aliases kept for compatibility
  | 'tonal'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'hero';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ComponentProps<typeof Icon>['name'];
  iconRight?: React.ComponentProps<typeof Icon>['name'];
  hint?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  haptic?: boolean;
  pill?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  iconLeft,
  iconRight,
  hint,
  style,
  fullWidth,
  haptic = true,
  pill,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radii, controlHeight } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const [focused, setFocused] = useState(false);

  const handlePressIn: PressableProps['onPressIn'] = (e) => {
    if (!isDisabled && haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    rest.onPressIn?.(e);
  };

  const normalizedVariant =
    variant === 'tonal' || variant === 'outline'
      ? 'secondary'
      : variant === 'ghost'
        ? 'quiet'
        : variant;

  const height =
    size === 'hero' || size === 'lg'
      ? 56
      : size === 'sm'
        ? 40
        : 48;

  const hitSlop = height < 48 ? Math.ceil((48 - height) / 2) : undefined;
  const buttonRadius = pill ? radii.full : size === 'hero' ? radii.xxl : radii.md;

  const getVariantContainerStyle = (pressed: boolean, hovered: boolean): ViewStyle => {
    switch (normalizedVariant) {
      case 'primary':
        return {
          backgroundColor: pressed || hovered ? colors.primary : colors.brandPrimary,
          borderWidth: 0,
          shadowColor: colors.primaryHover,
          shadowOffset: { width: 0, height: pressed ? 1 : 4 },
          shadowOpacity: isDisabled ? 0 : 1,
          shadowRadius: 0,
          elevation: pressed ? 1 : 4,
        };
      case 'secondary':
        return {
          backgroundColor: pressed || hovered ? colors.brandSecondaryDark : colors.brandSecondary,
          borderWidth: 0,
          shadowColor: colors.accentHover,
          shadowOffset: { width: 0, height: pressed ? 1 : 4 },
          shadowOpacity: isDisabled ? 0 : 1,
          shadowRadius: 0,
          elevation: pressed ? 1 : 4,
        };
      case 'quiet':
        return {
          backgroundColor: pressed || hovered ? colors.dangerSurface : 'transparent',
          borderWidth: 2,
          borderColor: colors.brandPrimary,
        };
      case 'link':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          paddingHorizontal: 0,
          minHeight: undefined,
        };
      case 'danger':
        return {
          backgroundColor: colors.danger,
          borderWidth: 0,
          shadowColor: colors.primaryHover,
          shadowOffset: { width: 0, height: pressed ? 1 : 4 },
          shadowOpacity: isDisabled ? 0 : 1,
          shadowRadius: 0,
          elevation: pressed ? 1 : 4,
        };
    }
  };

  const textColor =
    normalizedVariant === 'primary' ||
    normalizedVariant === 'secondary' ||
    normalizedVariant === 'danger'
      ? colors.onPrimary
      : normalizedVariant === 'quiet'
        ? colors.brandPrimary
        : normalizedVariant === 'link'
          ? colors.brandSecondary
          : colors.text;

  const horizontalPadding =
    normalizedVariant === 'link'
      ? 0
      : size === 'hero' || size === 'lg'
        ? 32
        : size === 'sm'
          ? 16
          : 24;

  return (
    <Pressable
      disabled={isDisabled}
      hitSlop={hitSlop}
      onPressIn={handlePressIn}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      accessibilityRole="button"
      style={(state) => {
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        const shiftDown = state.pressed && !isDisabled && normalizedVariant !== 'link';
        return [
          styles.base,
          {
            minHeight: normalizedVariant === 'link' ? 36 : height,
            paddingHorizontal: horizontalPadding,
            borderRadius: buttonRadius,
            opacity: isDisabled ? 0.45 : 1,
            transform: [{ translateY: shiftDown ? 3 : 0 }],
          },
          getVariantContainerStyle(state.pressed, hovered),
          focused && Platform.OS === 'web'
            ? ({ outlineWidth: 4, outlineStyle: 'solid', outlineColor: colors.brandSecondary, outlineOffset: 2 } as unknown as ViewStyle)
            : null,
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {iconLeft && <Icon name={iconLeft} size="sm" color={textColor} />}
            <Text
              role="display"
              variant={size === 'hero' || size === 'lg' ? 'body' : 'bodySmall'}
              style={{
                color: textColor,
                fontSize: size === 'hero' || size === 'lg' ? 18 : size === 'sm' ? 14 : 16,
                fontWeight: '700',
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {iconRight && <Icon name={iconRight} size="sm" color={textColor} />}
            {hint}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
});
