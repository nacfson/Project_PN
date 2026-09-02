import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CentralAuthScreen } from './CentralAuthScreen';
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
  it('renders the central redirect buttons', async () => {
    await render(<CentralAuthScreen />, { wrapper: Wrapper });
    expect(screen.getByText('Continue to Sign In')).toBeTruthy();
  });
});
