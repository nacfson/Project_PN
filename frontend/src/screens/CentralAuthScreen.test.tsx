import React from 'react';
import { Platform } from 'react-native';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { CentralAuthScreen } from './CentralAuthScreen';
import { API_BASE_URL } from '../config';
import { sessionStorage } from '../api/sessionStorage';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  FontDisplay: { SWAP: 'swap' },
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('../theme/motion', () => ({
  ...jest.requireActual('../theme/motion'),
  useReducedMotion: () => true,
}));

jest.mock('../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../api/sessionStorage', () => ({
  sessionStorage: {
    setSession: jest.fn().mockResolvedValue(undefined),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('CentralAuthScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the central redirect buttons and project explanation', async () => {
    await render(<CentralAuthScreen />, { wrapper: Wrapper });
    expect(screen.getByText('Continue to Sign In')).toBeTruthy();
    expect(screen.getByText('Project PN')).toBeTruthy();
    expect(screen.getByText('A word is global, but memory is personal.')).toBeTruthy();
  });

  it('redirects browser web to /api/auth/login and keeps Brand Pulse loading UI visible', async () => {
    const originalPlatform = Platform.OS;
    const originalWindow = global.window;
    try {
      Platform.OS = 'web';
      // @ts-expect-error Mocking window for web test
      global.window = {
        location: {
          origin: 'https://pn.nacfson.cloud',
          href: 'https://pn.nacfson.cloud/',
        },
      };

      await render(<CentralAuthScreen />, { wrapper: Wrapper });
      const button = screen.getByText('Continue to Sign In');
      await fireEvent.press(button);

      expect(global.window.location.href).toBe(`${API_BASE_URL}/api/auth/login`);
      expect(screen.getByTestId('auth-brand-pulse')).toBeTruthy();
      expect(screen.getByText('Opening secure sign-in…')).toBeTruthy();
      expect(screen.queryByText('Continue to Sign In')).toBeNull();
    } finally {
      Platform.OS = originalPlatform;
      global.window = originalWindow;
    }
  });

  it('resets loading UI back to Sign In when browser restores page from bfcache (pageshow)', async () => {
    const originalPlatform = Platform.OS;
    const originalWindow = global.window;
    let pageShowHandler: ((e: { persisted?: boolean }) => void) | undefined;

    try {
      Platform.OS = 'web';
      // @ts-expect-error Mocking window for web test
      global.window = {
        location: {
          origin: 'https://pn.nacfson.cloud',
          href: 'https://pn.nacfson.cloud/',
        },
        addEventListener: jest.fn((event: string, cb: (e: { persisted?: boolean }) => void) => {
          if (event === 'pageshow') pageShowHandler = cb;
        }),
        removeEventListener: jest.fn(),
      };

      await render(<CentralAuthScreen />, { wrapper: Wrapper });
      await fireEvent.press(screen.getByText('Continue to Sign In'));
      expect(screen.getByTestId('auth-brand-pulse')).toBeTruthy();

      await act(async () => {
        pageShowHandler?.({ persisted: true });
      });

      expect(screen.getByText('Continue to Sign In')).toBeTruthy();
    } finally {
      Platform.OS = originalPlatform;
      global.window = originalWindow;
    }
  });

  it('shows verifying state while awaiting native onTokenReceived callback', async () => {
    const originalPlatform = Platform.OS;
    let resolveTokenCheck!: () => void;
    const onTokenReceived = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTokenCheck = resolve;
        }),
    );

    try {
      Platform.OS = 'ios';
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: 'success',
        url: 'projectpn://auth?token=test-jwt',
      });

      await render(<CentralAuthScreen onTokenReceived={onTokenReceived} />, { wrapper: Wrapper });
      await fireEvent.press(screen.getByText('Continue to Sign In'));

      await waitFor(() => {
        expect(sessionStorage.setSession).toHaveBeenCalled();
        expect(onTokenReceived).toHaveBeenCalled();
        expect(screen.getByText('Syncing your personal memory…')).toBeTruthy();
      });

      await act(async () => {
        resolveTokenCheck();
      });

      await waitFor(() => {
        expect(screen.getByText('Continue to Sign In')).toBeTruthy();
      });
    } finally {
      Platform.OS = originalPlatform;
    }
  });
});


