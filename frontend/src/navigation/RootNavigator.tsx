import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { MainTabs } from './MainTabs';
import { navigationRef } from './navigationRef';

interface RootNavigatorProps {
  onLogout: () => void;
}

const linking = {
  prefixes: [Linking.createURL('/'), 'https://pn.nacfson.cloud', 'http://localhost:8081'],
  config: {
    screens: {
      Settings: {
        screens: {
          LinkApprove: {
            path: 'link-approve',
            parse: {
              requestId: (id: string) => id,
            },
          },
          LinkAccountPropose: 'link-account',
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
    <NavigationContainer ref={navigationRef} linking={linking}>
      <MainTabs onLogout={onLogout} />
    </NavigationContainer>
  );
}
