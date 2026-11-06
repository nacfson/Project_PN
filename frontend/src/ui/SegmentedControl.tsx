import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  testID?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'default' | 'alt';
  role?: 'tablist' | 'radiogroup';
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'default',
  role = 'tablist',
  style,
}: SegmentedControlProps<T>) {
  const { colors, radii, shadows } = useTheme();
  const trackBg = tone === 'alt' ? colors.fillAlt : colors.fill;
  const itemRole = role === 'radiogroup' ? 'radio' : 'tab';

  return (
    <View
      accessibilityRole={role}
      style={[
        styles.container,
        {
          backgroundColor: trackBg,
          borderColor: colors.hairline,
          borderWidth: 2,
          borderRadius: radii.full,
          padding: 4,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 5, bottom: 5 }}
            style={[
              styles.segment,
              {
                backgroundColor: active ? colors.brandSecondary : 'transparent',
                borderColor: active ? colors.brandSecondaryDark : 'transparent',
                borderWidth: active ? 1 : 0,
                borderRadius: radii.full,
              },
              active ? shadows.segment : null,
            ]}
            accessibilityRole={itemRole}
            accessibilityState={
              role === 'radiogroup'
                ? { checked: active, selected: active }
                : { selected: active }
            }
          >
            <Text
              variant="bodySmall"
              style={{
                color: active ? colors.onPrimary : colors.text,
                fontWeight: '700',
              }}
            >
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
    alignItems: 'center',
  },
  segment: {
    minHeight: 38,
    paddingHorizontal: 18,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
