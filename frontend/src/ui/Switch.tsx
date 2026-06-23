import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Switch({ value, onValueChange }: SwitchProps) {
  const { colors, radii } = useTheme();

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.primary : colors.outline,
          borderRadius: radii.full,
        },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.full,
            transform: [{ translateX: value ? 20 : 0 }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 32,
    padding: 4,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
