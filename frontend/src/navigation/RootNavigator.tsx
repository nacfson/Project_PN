import { NavigationContainer } from '@react-navigation/native';
import { MainTabs } from './MainTabs';

interface RootNavigatorProps {
  onLogout: () => void;
}

export function RootNavigator({ onLogout }: RootNavigatorProps) {
  return (
    <NavigationContainer>
      <MainTabs onLogout={onLogout} />
    </NavigationContainer>
  );
}
