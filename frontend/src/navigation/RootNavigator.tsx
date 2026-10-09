import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { MainTabs } from './MainTabs';
import { navigationRef } from './navigationRef';
import { analytics } from '../analytics/analytics';

interface RootNavigatorProps {
  onLogout: () => void;
}

const linking = {
  prefixes: [Linking.createURL('/'), 'https://pn.nacfson.cloud', 'http://localhost:8081'],
  config: {
    screens: {
      Settings: {
        screens: {
          ConnectedAccounts: 'connected-accounts',
          SettingsRoot: '',
        },
      },
      Learn: 'learn',
      Words: 'words',
      Add: 'add',
      Practice: 'practice',
    },
  },
};

export function RootNavigator({ onLogout }: RootNavigatorProps) {
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        const route = navigationRef.getCurrentRoute();
        if (route) analytics.track('screen_viewed', { screen: route.name });
      }}
      onStateChange={() => {
        const route = navigationRef.getCurrentRoute();
        if (route) analytics.track('screen_viewed', { screen: route.name });
      }}
    >
      <MainTabs onLogout={onLogout} />
    </NavigationContainer>
  );
}
