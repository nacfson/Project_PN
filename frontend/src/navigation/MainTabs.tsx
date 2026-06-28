import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueueBanner } from '../components/QueueBanner';
import { AddScreen } from './AddScreen';
import { SettingsStack } from './SettingsStack';
import { WordsStack } from './WordsStack';
import { HomeScreen } from '../features/learn/HomeScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { CommandDock } from '../features/web/CommandDock';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui';

export type MainTabParamList = {
  Learn: undefined;
  Words: undefined;
  Add: undefined;
  Practice: undefined;
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

export function MainTabs({ onLogout }: MainTabsProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View style={styles.root}>
      <QueueBanner />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.onPrimaryContainer,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: colors.surfaceContainer,
            borderTopColor: colors.outlineVariant,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: spacing.xs,
          },
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
