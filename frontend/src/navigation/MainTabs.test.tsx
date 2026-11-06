import React from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, screen } from '@testing-library/react-native';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MainTabs } from './MainTabs';

let mockWidth = 1200;

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    createBottomTabNavigator: () => {
      const Screen = (_props: any) => null;
      const Navigator = ({ children, tabBar, screenOptions }: any) => {
        const screens = React.Children.toArray(children).filter(Boolean) as any[];
        const routes = screens.map((child: any, idx: number) => ({
          key: `${child.props.name}-${idx}`,
          name: child.props.name,
          params: undefined,
        }));
        const state = {
          index: 0,
          key: 'tab-state',
          routeNames: routes.map((r: any) => r.name),
          routes,
          type: 'tab',
          stale: false,
          history: [{ type: 'route', key: routes[0]?.key }],
        };
        const navigation = {
          navigate: jest.fn(),
          emit: jest.fn(() => ({ defaultPrevented: false })),
          dispatch: jest.fn(),
        };
        const descriptors: Record<string, any> = {};
        routes.forEach((route: any, idx: number) => {
          const child = screens[idx];
          const baseOpts =
            typeof screenOptions === 'function' ? screenOptions({ route, navigation }) : screenOptions || {};
          const childOpts =
            typeof child.props.options === 'function'
              ? child.props.options({ route, navigation })
              : child.props.options || {};
          descriptors[route.key] = {
            route,
            navigation,
            options: { ...baseOpts, ...childOpts },
            render: () => {
              const Comp = child.props.component;
              return Comp ? <Comp /> : child.props.children?.({ route, navigation }) ?? null;
            },
          };
        });
        const insets = { top: 0, right: 0, bottom: 0, left: 0 };
        return (
          <View testID="mock-tab-navigator">
            {tabBar ? tabBar({ state, descriptors, navigation, insets }) : null}
            {descriptors[routes[0]?.key]?.render()}
          </View>
        );
      };
      return { Navigator, Screen };
    },
  };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
}));

jest.mock('../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../hooks/useActiveTargetLanguage', () => ({
  useActiveTargetLanguage: () => ({
    targetLanguage: 'en',
    displayLanguage: 'English',
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('../hooks/useAddQueue', () => ({
  useAddQueue: () => ({
    jobs: [],
    pendingCount: 0,
    dismissedIds: new Set(),
    dismiss: jest.fn(),
    failedItems: [],
    retryFailed: jest.fn(),
    dismissFailed: jest.fn(),
  }),
}));

jest.mock('../features/learn/HomeScreen', () => ({
  HomeScreen: () => {
    const { View } = require('react-native');
    return <View testID="mock-home-screen" />;
  },
}));
jest.mock('./WordsStack', () => ({
  WordsStack: () => {
    const { View } = require('react-native');
    return <View testID="mock-words-stack" />;
  },
}));
jest.mock('./AddScreen', () => ({
  AddScreen: () => {
    const { View } = require('react-native');
    return <View testID="mock-add-screen" />;
  },
}));
jest.mock('../features/practice/PracticeScreen', () => ({
  PracticeScreen: () => {
    const { View } = require('react-native');
    return <View testID="mock-practice-screen" />;
  },
}));
jest.mock('./SettingsStack', () => ({
  SettingsStack: () => {
    const { View } = require('react-native');
    return <View testID="mock-settings-stack" />;
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: mockWidth, height: 800 },
      }}
    >
      <ThemeProvider>
        <AppLanguageProvider>{children}</AppLanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('MainTabs shell layout', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

  beforeEach(() => {
    mockWidth = 1200;
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Platform, 'OS', originalDescriptor);
    }
  });

  it('renders Sidebar at 1200 px on browser shell with PN mark, 5 items in order, and active language pair', async () => {
    await render(<MainTabs onLogout={jest.fn()} />, { wrapper: Wrapper });

    expect(screen.getByTestId('shell-sidebar')).toBeTruthy();
    expect(screen.getByText('PN')).toBeTruthy();
    expect(screen.getByTestId('tab-button-learn')).toBeTruthy();
    expect(screen.getByTestId('tab-button-words')).toBeTruthy();
    expect(screen.getByTestId('tab-button-add')).toBeTruthy();
    expect(screen.getByTestId('tab-button-practice')).toBeTruthy();
    expect(screen.getByTestId('tab-button-settings')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText(/English/)).toBeTruthy();
  });

  it('renders bottom bar at 600 px on browser shell and on phone shell', async () => {
    mockWidth = 600;
    const { unmount } = await render(<MainTabs onLogout={jest.fn()} />, { wrapper: Wrapper });

    expect(screen.getByTestId('shell-bottom-bar')).toBeTruthy();
    expect(screen.queryByTestId('shell-sidebar')).toBeNull();
    expect(screen.getByTestId('tab-button-learn')).toBeTruthy();
    expect(screen.getByTestId('tab-button-settings')).toBeTruthy();
    await unmount();

    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });
    mockWidth = 1200;
    await render(<MainTabs onLogout={jest.fn()} />, { wrapper: Wrapper });
    expect(screen.getByTestId('shell-bottom-bar')).toBeTruthy();
    expect(screen.queryByTestId('shell-sidebar')).toBeNull();
  });

  it('hides navigation chrome when chromeHidden is true', async () => {
    await render(<MainTabs onLogout={jest.fn()} initialChromeHidden />, { wrapper: Wrapper });

    expect(screen.queryByTestId('shell-sidebar')).toBeNull();
    expect(screen.queryByTestId('shell-bottom-bar')).toBeNull();
  });
});
