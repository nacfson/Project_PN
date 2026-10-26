import { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { BROWSER_PAGE_MIN_WIDTH, browserPageWidth, browserScale } from './shellKind';

export const BROWSER_PAGE_WIDTH = BROWSER_PAGE_MIN_WIDTH;

export function BrowserFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const scale = browserScale(width);
  const pageWidth = browserPageWidth(width);
  return (
    <View
      testID="browser-shell"
      style={{ width: '100%', flex: 1, alignItems: 'center', overflow: 'hidden' }}
    >
      <View style={{ width: pageWidth * scale, flex: 1, overflow: 'hidden' }}>
        <View
          testID="browser-frame"
          style={{
            width: pageWidth,
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
