import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainTabParamList } from './MainTabs';

export const navigationRef = createNavigationContainerRef<MainTabParamList>();

export function navigateToLinkPropose(provider: string, email: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Settings', {
      screen: 'LinkAccountPropose',
      params: { provider, email },
    });
  }
}

export function navigateToLinkApprove(requestId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Settings', {
      screen: 'LinkApprove',
      params: { requestId },
    });
  }
}
