import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAddQueue } from '../../hooks/useAddQueue';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Text } from '../../ui';
import type { MainTabParamList } from '../../navigation/MainTabs';

type NavigationProp = BottomTabNavigationProp<MainTabParamList>;

const DOCK_ITEMS = [
  { id: 'add', icon: 'add', label: 'Add word', testID: 'dock-add', action: 'navigateAdd' as const },
  { id: 'practice', icon: 'school', label: 'Review', testID: 'dock-practice', action: 'navigatePractice' as const },
  { id: 'search', icon: 'search', label: 'Search', testID: 'dock-search', action: 'navigateWords' as const },
  { id: 'theme', icon: 'contrast', label: 'Theme', testID: 'dock-theme', action: 'toggleTheme' as const },
];

export function CommandDock() {
  if (Platform.OS !== 'web') return null;

  const { colors, spacing, radii, mode, setMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { pendingCount } = useAddQueue();
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  // When reduced motion is preferred, keep the dock permanently expanded
  const isExpanded = reducedMotion || expanded;

  const handleAction = (action: (typeof DOCK_ITEMS)[number]['action']) => {
    switch (action) {
      case 'navigateAdd':
        navigation.navigate('Add');
        break;
      case 'navigatePractice':
        navigation.navigate('Practice');
        break;
      case 'navigateWords':
        navigation.navigate('Words');
        break;
      case 'toggleTheme':
        setMode(mode === 'dark' ? 'light' : 'dark');
        break;
    }
  };

  const dockStyle: ViewStyle = {
    position: 'fixed' as any,
    right: 20,
    bottom: 100,
    zIndex: 100,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    gap: spacing.sm,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  };

  return (
    <View style={dockStyle}>
      {(isExpanded ? DOCK_ITEMS : DOCK_ITEMS.slice(0, 1)).map((item) => (
        <Pressable
          key={item.id}
          testID={item.testID}
          onPress={() => handleAction(item.action)}
          style={(state): ViewStyle => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.full,
            backgroundColor: (state as { hovered?: boolean }).hovered
              ? colors.primaryContainer
              : 'transparent',
          })}
          onHoverIn={() => { if (!reducedMotion) setExpanded(true); }}
          onHoverOut={() => { if (!reducedMotion) setExpanded(false); }}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Icon name={item.icon as never} size="md" color={colors.primary} />
          {isExpanded ? (
            <Text variant="label" color="primary">
              {item.label}
              {item.id === 'add' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
