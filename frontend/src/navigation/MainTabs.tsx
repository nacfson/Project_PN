import React, { useState, useContext, useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import { QueueBanner } from '../components/QueueBanner';
import { AddScreen } from './AddScreen';
import { SettingsStack, type SettingsStackParamList } from './SettingsStack';
import { WordsStack } from './WordsStack';
import { HomeScreen } from '../features/learn/HomeScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { CommandDock } from '../features/web/CommandDock';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui';
import { TabBarScrollContext } from '../ui/Screen';
import { BrowserFrame } from './browserFrame';
import { PhoneFrame } from './phoneFrame';
import { shellKind } from './shellKind';
import { TabSlot } from './TabSlot';

export type MainTabParamList = {
  Learn: undefined;
  Words: undefined;
  Add: undefined;
  Practice: { deckId?: string; origin?: 'private' } | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabsProps {
  onLogout: () => void;
}

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Icon>['name']; focused: boolean }) {
  const { colors } = useTheme();
  return <Icon name={name} size="md" color={focused ? colors.onPrimaryContainer : colors.onSurfaceVariant} />;
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollContext = useContext(TabBarScrollContext);
  
  // Unconditional declaration of Reanimated hooks to adhere to React Rules of Hooks
  const fallbackTranslateY = useSharedValue(0);
  const translateY = scrollContext?.tabBarTranslateY ?? fallbackTranslateY;
  const tabBarInteractive = scrollContext?.tabBarInteractive ?? true;

  const tabBarHeight = 60 + insets.bottom;

  // Translate tab bar down out of view based on scroll shared value
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            translateY.value,
            [0, 100],
            [0, tabBarHeight],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={tabBarInteractive ? 'auto' : 'none'}
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.outlineVariant,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
        },
        animatedStyle,
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabSlot
            key={route.key}
            label={typeof label === 'string' ? label : route.name}
            focused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            testID={options.tabBarButtonTestID || `tab-button-${route.name.toLowerCase()}`}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            icon={
              options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? colors.primary : colors.onSurfaceVariant,
                size: 24,
              }) ?? null
            }
          />
        );
      })}
    </Animated.View>
  );
}

export function MainTabs({ onLogout }: MainTabsProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const userAgent =
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const kind = shellKind(Platform.OS, userAgent);
  const Frame = kind === 'browser' ? BrowserFrame : PhoneFrame;
  const tabBarTranslateY = useSharedValue(0);
  const [tabBarInteractive, setTabBarInteractiveState] = useState(true);
  const setTabBarInteractive = useCallback((interactive: boolean) => {
    setTabBarInteractiveState(interactive);
  }, []);

  return (
    <TabBarScrollContext.Provider value={{ tabBarTranslateY, tabBarInteractive, setTabBarInteractive }}>
      <Frame>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <QueueBanner />
        <Tab.Navigator
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: styles.scene,
          }}
        >
          <Tab.Screen
            name="Learn"
            component={HomeScreen}
            options={{
              tabBarLabel: t('tabs.learn'),
              tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Words"
            options={{
              tabBarLabel: t('tabs.words'),
              tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'book' : 'book-outline'} focused={focused} />,
            }}
          >
            {() => <WordsStack />}
          </Tab.Screen>
          <Tab.Screen
            name="Add"
            component={AddScreen}
            options={{
              tabBarLabel: t('tabs.add'),
              tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'add-circle' : 'add-circle-outline'} focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Practice"
            component={PracticeScreen}
            options={{
              tabBarLabel: t('tabs.practice'),
              tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'layers' : 'layers-outline'} focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            options={{
              tabBarLabel: t('tabs.settings'),
              tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />,
            }}
          >
            {() => <SettingsStack onLogout={onLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
        {kind === 'browser' ? <CommandDock /> : null}
      </View>
      </Frame>
    </TabBarScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scene: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    zIndex: 100,
  },
});
