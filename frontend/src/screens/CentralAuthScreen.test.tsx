import React from 'react';
import { Platform } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CentralAuthScreen } from './CentralAuthScreen';
import { API_BASE_URL } from '../config';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('CentralAuthScreen', () => {
  it('renders the central redirect buttons and project explanation', async () => {
    await render(<CentralAuthScreen />, { wrapper: Wrapper });
    expect(screen.getByText('Continue to Sign In')).toBeTruthy();
    expect(screen.getByText('Project PN')).toBeTruthy();
    expect(screen.getByText('A word is global, but memory is personal.')).toBeTruthy();
  });

  it('redirects browser web to project backend /api/auth/login endpoint on press', async () => {
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
    } finally {
      Platform.OS = originalPlatform;
      global.window = originalWindow;
    }
  });
});

