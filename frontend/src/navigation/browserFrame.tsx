import { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { browserScale } from './shellKind';

export const BROWSER_PAGE_WIDTH = 420;

export function BrowserFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const scale = browserScale(width);
  return (
    <View
      testID="browser-shell"
      style={{ width: '100%', flex: 1, alignItems: 'center', overflow: 'hidden' }}
    >
      <View style={{ width: BROWSER_PAGE_WIDTH * scale, flex: 1, overflow: 'hidden' }}>
        <View
          testID="browser-frame"
          style={{
            width: BROWSER_PAGE_WIDTH,
            position: 'relative',
            flex: 1,
            transform: [{ scale }],
            transformOrigin: 'top left',
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
