import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

interface ChipProps extends Omit<PressableProps, 'children'> {
  label: string;
  selected?: boolean;
  icon?: React.ComponentProps<typeof Icon>['name'];
}

export function Chip({ label, selected = false, icon, ...rest }: ChipProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.secondaryContainer : 'transparent',
          borderColor: selected ? 'transparent' : colors.outline,
          borderRadius: radii.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.8 : 1,
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
    </Pressable>
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
