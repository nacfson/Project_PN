import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AddScreen } from './AddScreen';
import { HomeScreen } from '../features/learn/HomeScreen';
import { MyWordsScreen } from '../features/words/MyWordsScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { useTheme } from '../theme/ThemeProvider';

export type MainTabParamList = {
  Learn: undefined;
  Words: undefined;
  Add: undefined;
  Practice: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabsProps {
  onLogout: () => void;
}

export function MainTabs({ onLogout }: MainTabsProps) {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen name="Learn" component={HomeScreen} />
      <Tab.Screen name="Words" component={MyWordsScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Practice" component={PracticeScreen} />
      <Tab.Screen
        name="Profile"
        children={() => <ProfileScreen onLogout={onLogout} />}
      />
    </Tab.Navigator>
  );
}
