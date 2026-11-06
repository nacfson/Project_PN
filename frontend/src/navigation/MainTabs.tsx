import React, { useState, useContext, useCallback } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';

import { QueueBanner } from '../components/QueueBanner';
import { AddScreen } from './AddScreen';
import { SettingsStack, type SettingsStackParamList } from './SettingsStack';
import { WordsStack } from './WordsStack';
import { HomeScreen } from '../features/learn/HomeScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui';
import { TabBarScrollContext } from '../ui/Screen';
import { BrowserFrame } from './browserFrame';
import { PhoneFrame } from './phoneFrame';
import { shellKind, shellLayout } from './shellKind';
import { Sidebar } from './Sidebar';
import { TabSlot } from './TabSlot';

export type MainTabParamList = {
  Learn: undefined;
  Words: undefined;
  Add: undefined;
  Practice: { deckId?: string; origin?: 'private' } | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export interface MainTabsProps {
  onLogout: () => void;
  initialChromeHidden?: boolean;
}

function TabIcon({
  name,
  focused,
}: {
  name: React.ComponentProps<typeof Icon>['name'];
  focused: boolean;
}) {
  const { colors } = useTheme();
  return <Icon name={name} size="md" color={focused ? colors.text : colors.textMuted} />;
}

function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollContext = useContext(TabBarScrollContext);

  if (scrollContext?.chromeHidden) {
    return null;
  }

  return (
    <View
      testID="shell-bottom-bar"
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.canvas,
          borderTopColor: colors.hairline,
          minHeight: layout.tabBarItemMinHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
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
                color: isFocused ? colors.text : colors.textMuted,
                size: 22,
              }) ?? null
            }
          />
        );
      })}
    </View>
  );
}

export function MainTabs({ onLogout, initialChromeHidden = false }: MainTabsProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const userAgent =
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const kind = shellKind(Platform.OS, userAgent);
  const currentLayout = shellLayout(kind, width);
  const Frame = kind === 'browser' ? BrowserFrame : PhoneFrame;

  const tabBarTranslateY = useSharedValue(0);
  const [tabBarInteractive, setTabBarInteractiveState] = useState(true);
  const [chromeHidden, setChromeHiddenState] = useState(initialChromeHidden);

  const setTabBarInteractive = useCallback((interactive: boolean) => {
    setTabBarInteractiveState(interactive);
  }, []);

  const setChromeHidden = useCallback((hidden: boolean) => {
    setChromeHiddenState(hidden);
  }, []);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => {
      if (chromeHidden) {
        return null;
      }
      if (currentLayout === 'sidebar') {
        return <Sidebar {...props} />;
      }
      return <BottomTabBar {...props} />;
    },
    [chromeHidden, currentLayout],
  );

  return (
    <TabBarScrollContext.Provider
      value={{
        tabBarTranslateY,
        tabBarInteractive,
        setTabBarInteractive,
        chromeHidden,
        setChromeHidden,
      }}
    >
      <Frame>
        <View style={[styles.root, { backgroundColor: colors.canvas }]}>
          <QueueBanner />
          <Tab.Navigator
            tabBar={renderTabBar}
            screenOptions={{
              headerShown: false,
              tabBarPosition: currentLayout === 'sidebar' ? 'left' : 'bottom',
              sceneStyle: [styles.scene, { backgroundColor: colors.canvas }],
            }}
          >
            <Tab.Screen
              name="Learn"
              component={HomeScreen}
              options={{
                tabBarLabel: t('tabs.today'),
                tabBarIcon: ({ focused }) => (
                  <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
                ),
              }}
            />
            <Tab.Screen
              name="Words"
              options={{
                tabBarLabel: t('tabs.words'),
                tabBarIcon: ({ focused }) => (
                  <TabIcon name={focused ? 'book' : 'book-outline'} focused={focused} />
                ),
              }}
            >
              {() => <WordsStack />}
            </Tab.Screen>
            <Tab.Screen
              name="Add"
              component={AddScreen}
              options={{
                tabBarLabel: t('tabs.add'),
                tabBarIcon: ({ focused }) => (
                  <TabIcon name={focused ? 'add' : 'add-outline'} focused={focused} />
                ),
              }}
            />
            <Tab.Screen
              name="Practice"
              component={PracticeScreen}
              options={{
                tabBarLabel: t('tabs.practice'),
                tabBarIcon: ({ focused }) => (
                  <TabIcon name={focused ? 'layers' : 'layers-outline'} focused={focused} />
                ),
              }}
            />
            <Tab.Screen
              name="Settings"
              options={{
                tabBarLabel: t('tabs.settings'),
                tabBarIcon: ({ focused }) => (
                  <TabIcon name={focused ? 'options' : 'options-outline'} focused={focused} />
                ),
              }}
            >
              {() => <SettingsStack onLogout={onLogout} />}
            </Tab.Screen>
          </Tab.Navigator>
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
    borderTopWidth: 1,
  },
});
