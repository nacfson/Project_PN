import { ReactNode } from 'react';
import { View } from 'react-native';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <View testID="phone-frame" style={{ flex: 1, width: '100%' }}>
      {children}
    </View>
  );
}
