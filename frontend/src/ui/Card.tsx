import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: 'filled' | 'outlined';
  onPress?: () => void;
}

export function Card({ elevated, variant = 'filled', onPress, style, children, ...rest }: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const cardBody = (
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

  if (!onPress) {
    return cardBody;
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {cardBody}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
