import React, { useState, useContext } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  interpolate,
  Extrapolation,
  withTiming,
} from 'react-native-reanimated';

import { QueueBanner } from '../components/QueueBanner';
import { AddScreen } from './AddScreen';
import { SettingsStack } from './SettingsStack';
import { WordsStack } from './WordsStack';
import { HomeScreen } from '../features/learn/HomeScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { CommandDock } from '../features/web/CommandDock';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from '../ui';
import { TabBarScrollContext } from '../ui/Screen';

export type MainTabParamList = {
  Learn: undefined;
  Words: undefined;
  Add: undefined;
  Practice: { deckId?: string } | undefined;
  Settings: undefined;
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
  const { colors, spacing, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollContext = useContext(TabBarScrollContext);
  
  // Unconditional declaration of Reanimated hooks to adhere to React Rules of Hooks
  const fallbackTranslateY = useSharedValue(0);
  const translateY = scrollContext?.tabBarTranslateY ?? fallbackTranslateY;

  const tabBarHeight = 60 + insets.bottom;
  const [containerWidth, setContainerWidth] = useState(0);

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

  const tabCount = state.routes.length;
  const tabWidth = containerWidth / tabCount;

  // Derive the horizontal position of the active pill indicator
  const pillLeft = useDerivedValue(() => {
    if (tabWidth === 0) return 0;
    return withTiming(state.index * tabWidth, { duration: 250 });
  });

  const pillAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: pillLeft.value }],
      width: tabWidth,
    };
  });

  return (
    <Animated.View
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
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Sliding Pill Indicator */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.pillContainer,
            pillAnimatedStyle,
            {
              height: 40,
              top: 10,
            },
          ]}
        >
          <View
            style={[
              styles.pill,
              {
                backgroundColor: colors.primaryContainer,
                borderRadius: radii.full,
              },
            ]}
          />
        </Animated.View>
      )}

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
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID || `tab-button-${route.name.toLowerCase()}`}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {options.tabBarIcon &&
              options.tabBarIcon({
                focused: isFocused,
              })}
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isFocused ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                  marginTop: 2,
                },
              ]}
            >
              {label as string}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

export function MainTabs({ onLogout }: MainTabsProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const tabBarTranslateY = useSharedValue(0);

  return (
    <TabBarScrollContext.Provider value={{ tabBarTranslateY }}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <QueueBanner />
        <Tab.Navigator
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
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
        <CommandDock />
      </View>
    </TabBarScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
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
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  pillContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  pill: {
    width: '75%',
    height: '100%',
  },
});
