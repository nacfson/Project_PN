import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthLoadingCard } from './AuthLoadingCard';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('AuthLoadingCard', () => {
  it('reveals Cancel & Try Again after slowThresholdMs and invokes onCancel', async () => {
    const onCancel = jest.fn();
    await render(
      <AuthLoadingCard
        title="Opening secure sign-in…"
        onCancel={onCancel}
        slowThresholdMs={15}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading-cancel')).toBeTruthy();
    });
    expect(screen.getByText('Taking a few extra seconds — almost there.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('auth-loading-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
