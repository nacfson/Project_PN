import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChipProps extends Omit<PressableProps, 'children'> {
  label: string;
  selected?: boolean;
  icon?: React.ComponentProps<typeof Icon>['name'];
}

export function Chip({ label, selected = false, icon, ...rest }: ChipProps) {
  const { colors, radii, spacing, motion, reduced } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1.0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (reduced) {
      scaleAnim.setValue(1.0);
      return;
    }

    scaleAnim.setValue(1.0);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.05,
        tension: motion.spring.bouncy.tension,
        friction: motion.spring.bouncy.friction,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.0,
        tension: motion.spring.bouncy.tension,
        friction: motion.spring.bouncy.friction,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selected, reduced, motion.spring.bouncy, scaleAnim]);

  return (
    <AnimatedPressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.secondaryContainer : 'transparent',
          borderColor: selected ? 'transparent' : colors.outline,
          borderRadius: radii.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: scaleAnim as any }],
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...rest}
    >
      {icon && <Icon name={icon} size="sm" color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} />}
      <Text
        variant="label"
        color={selected ? 'onSecondaryContainer' : 'muted'}
        style={{ fontWeight: selected ? '600' : '500' }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
