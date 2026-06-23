import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerHighest, borderRadius: radii.full, padding: spacing.xs }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: active ? colors.secondaryContainer : 'transparent',
                borderRadius: radii.full,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text variant="label" color={active ? 'onSecondaryContainer' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
