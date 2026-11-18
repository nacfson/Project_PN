import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import App from './App';
import * as authApi from './src/api/auth';
import { sessionStorage } from './src/api/sessionStorage';
import { onboardingStorage } from './src/api/storage';

jest.mock('./src/api/auth');
jest.mock('./src/api/sessionStorage', () => ({
  sessionStorage: {
    getToken: jest.fn(),
    getRefreshToken: jest.fn(),
    getExpiresAt: jest.fn(),
    setSession: jest.fn(),
    clearSession: jest.fn(),
  },
}));
jest.mock('./src/api/storage', () => ({
  onboardingStorage: {
    getCompleted: jest.fn(),
    setCompleted: jest.fn(),
  },
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  themeModeStorage: {
    getMode: jest.fn().mockResolvedValue('light'),
    setMode: jest.fn().mockResolvedValue(undefined),
  },
  themeVariationStorage: {
    getVariation: jest.fn().mockResolvedValue('default'),
    setVariation: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('./src/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));
jest.mock('./src/utils/authLaunch', () => ({
  extractSessionFromUrl: jest.fn(() => null),
  parseSessionFromLaunchUrl: jest.fn().mockResolvedValue(null),
}));
jest.mock('./src/navigation/RootNavigator', () => ({
  RootNavigator: () => {
    const { Text } = require('react-native');
    return <Text testID="authenticated-app">Main Learning Tabs</Text>;
  },
}));

describe('App fail-closed auth gate (001-gateway-jwt-auth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (onboardingStorage.getCompleted as jest.Mock).mockResolvedValue(true);
    (sessionStorage.getToken as jest.Mock).mockResolvedValue(null);
  });

  it('fails closed to unauthenticated on backend network/connection error', async () => {
    (authApi.me as jest.Mock).mockRejectedValue(new Error('Network error: failed to connect to backend'));

    await render(<App />);

    // Must show CentralAuthScreen and NEVER AuthenticatedApp
    await waitFor(() => {
      expect(screen.getByText('Continue to Sign In')).toBeTruthy();
    });

    expect(screen.queryByTestId('authenticated-app')).toBeNull();
  });

  it('fails closed to unauthenticated on 401 Unauthorized', async () => {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    (authApi.me as jest.Mock).mockRejectedValue(err);

    await render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Continue to Sign In')).toBeTruthy();
    });

    expect(screen.queryByTestId('authenticated-app')).toBeNull();
  });

  it('transitions to authenticated only when backend me() succeeds', async () => {
    (sessionStorage.getToken as jest.Mock).mockResolvedValue('valid-access-token');
    (authApi.me as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'learner@example.com',
      email_verified: true,
      native_language: 'ko',
      target_language: 'en',
      ui_language: 'en',
      active_language: { id: 'lang-1', target_language: 'en' },
    });

    await render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated-app')).toBeTruthy();
    });

    expect(screen.queryByText('Continue to Sign In')).toBeNull();
  });

  it('shows Brand Pulse LoadingScreen while verifying session on return/launch', async () => {
    (sessionStorage.getToken as jest.Mock).mockResolvedValue('valid-access-token');
    let resolveMe!: (val: unknown) => void;
    (authApi.me as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );

    await render(<App />);

    await waitFor(() => {
      expect(authApi.me).toHaveBeenCalled();
    });
    expect(screen.getByTestId('auth-brand-pulse')).toBeTruthy();
    expect(screen.getByText('Syncing your personal memory…')).toBeTruthy();

    await act(async () => {
      resolveMe({
        id: 'user-123',
        email: 'learner@example.com',
        email_verified: true,
        native_language: 'ko',
        target_language: 'en',
        ui_language: 'en',
        active_language: { id: 'lang-1', target_language: 'en' },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated-app')).toBeTruthy();
    });
  });
});
