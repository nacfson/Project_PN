import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CentralAuthScreen, getDoorReturnAddress } from './CentralAuthScreen';
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

  it('renders continue browsing button when callback is provided', async () => {
    const onBrowse = jest.fn();
    await render(<CentralAuthScreen onContinueBrowsing={onBrowse} />, { wrapper: Wrapper });
    const browseBtn = screen.getByText('Browse without signing in');
    expect(browseBtn).toBeTruthy();
    fireEvent.press(browseBtn);
    expect(onBrowse).toHaveBeenCalled();
  });

  it('computes door return address properly', () => {
    const returnAddr = getDoorReturnAddress();
    expect(returnAddr).toBeTruthy();
    expect(returnAddr.startsWith('http://') || returnAddr.startsWith('https://')).toBe(true);
  });
});
