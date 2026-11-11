import { useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAddQueue } from '../../hooks/useAddQueue';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import { Icon, Text } from '../../ui';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { navigationRef } from '../../navigation/navigationRef';

type NavigationProp = BottomTabNavigationProp<MainTabParamList>;

const DOCK_ITEMS = [
  { id: 'add', icon: 'add', labelKey: 'commandDock.addWord' as const, testID: 'dock-add', action: 'navigateAdd' as const },
  { id: 'practice', icon: 'school', labelKey: 'commandDock.review' as const, testID: 'dock-practice', action: 'navigatePractice' as const },
  { id: 'search', icon: 'search', labelKey: 'commandDock.search' as const, testID: 'dock-search', action: 'navigateWords' as const },
];

/** Hide the desktop floating dock on phone-sized web viewports. */
const MOBILE_WEB_MAX_WIDTH = 720;

export interface CommandDockProps {
  navigation?: NavigationProp;
}

export function CommandDock({ navigation: propNavigation }: CommandDockProps = {}) {
  const { colors, spacing, radii } = useTheme();
  let hookNavigation: NavigationProp | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hookNavigation = useNavigation<NavigationProp>();
  } catch {
    // Rendered outside navigation container
  }
  const navigation = propNavigation ?? hookNavigation;
  const { pendingCount } = useAddQueue();
  const reducedMotion = useReducedMotion();
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  if (Platform.OS !== 'web' || width < MOBILE_WEB_MAX_WIDTH) {
    return null;
  }

  // When reduced motion is preferred, keep the dock permanently expanded
  const isExpanded = reducedMotion || expanded;

  const handleAction = (action: (typeof DOCK_ITEMS)[number]['action']) => {
    const nav = navigation ?? (navigationRef.isReady() ? navigationRef : null);
    if (!nav) return;
    switch (action) {
      case 'navigateAdd':
        (nav as any).navigate('Add', { mode: 'manual', focusTick: Date.now() });
        break;
      case 'navigatePractice':
        (nav as any).navigate('Practice', { origin: 'private' });
        break;
      case 'navigateWords':
        (nav as any).navigate('Words');
        break;
    }
  };

  const dockStyle: ViewStyle = {
    position: 'absolute',
    right: 12,
    bottom: 72,
    zIndex: 100,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
    gap: spacing.sm,
  };

  return (
    <View testID="command-dock" style={dockStyle}>
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
              ? colors.fill
              : 'transparent',
          })}
          onHoverIn={() => { if (!reducedMotion) setExpanded(true); }}
          onHoverOut={() => { if (!reducedMotion) setExpanded(false); }}
          accessibilityRole="button"
          accessibilityLabel={t(item.labelKey)}
        >
          <Icon name={item.icon as never} size="md" color={colors.accent} />
          {isExpanded ? (
            <Text variant="label" color="primary">
              {t(item.labelKey)}
              {item.id === 'add' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
