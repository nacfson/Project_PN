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
  const { colors, radii } = useTheme();
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
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        marginVertical: 6,
        paddingHorizontal: 4,
        borderRadius: radii.full,
        backgroundColor: focused ? colors.primaryContainer : 'transparent',
      }}
    >
      {icon}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        variant="caption"
        style={{
          maxWidth: '100%',
          color: focused ? colors.onPrimaryContainer : colors.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
