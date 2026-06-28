import { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { InspectorPanel } from './InspectorPanel';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'web';
  return RN;
});

// The RN test environment lacks window — shim for web-only Escape handler
const mockWindowListeners: Record<string, jest.Mock> = {};
beforeAll(() => {
  (globalThis as any).window = {
    addEventListener: jest.fn((event, handler) => {
      mockWindowListeners[event] = handler as jest.Mock;
    }),
    removeEventListener: jest.fn((event) => {
      delete mockWindowListeners[event];
    }),
  } as any;
});

describe('InspectorPanel', () => {
  it('renders children when visible', async () => {
    await render(
      <InspectorPanel visible onClose={jest.fn()}>
        <Text>Inspector content</Text>
      </InspectorPanel>,
      { wrapper: Wrapper }
    );
    expect(screen.getByText('Inspector content')).toBeTruthy();
  });

  it('calls onClose when backdrop is pressed', async () => {
    const onClose = jest.fn();
    await render(
      <InspectorPanel visible onClose={onClose}>
        <Text>Content</Text>
      </InspectorPanel>,
      { wrapper: Wrapper }
    );
    fireEvent.press(screen.getByTestId('inspector-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
