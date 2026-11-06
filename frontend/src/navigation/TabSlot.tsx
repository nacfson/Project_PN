import { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

export function TabSlot({
  label,
  focused,
  onPress,
  onLongPress,
  testID,
  icon,
  accessibilityLabel,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID: string;
  icon: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors, layout } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        overflow: 'hidden',
        maxWidth: '100%',
        flex: 1,
        minHeight: layout.tabBarItemMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        paddingVertical: 6,
        gap: 3,
      }}
    >
      {icon}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        variant="micro"
        style={{
          maxWidth: '100%',
          color: focused ? colors.text : colors.textMuted,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
