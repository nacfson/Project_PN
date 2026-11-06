import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

export function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
  const { colors, radii, shadows } = useTheme();

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.primary : colors.controlBorder,
          borderColor: value ? colors.primary : colors.controlBorderStrong,
          borderRadius: radii.full,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.onPrimary,
            borderRadius: radii.full,
            transform: [{ translateX: value ? 18 : 0 }],
          },
          shadows.segment,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 20,
    height: 20,
  },
});
