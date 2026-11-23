import React, { type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { useAddQueue } from '../hooks/useAddQueue';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { classifyAddError } from '../utils/addErrors';
import { QueueBanner } from './QueueBanner';

jest.mock('../hooks/useAddQueue', () => ({
  useAddQueue: jest.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      <AppLanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

describe('QueueBanner', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('groups multiple failed jobs into a collapsible summary with Retry failed and Dismiss all', async () => {
    const retryAllFailed = jest.fn();
    const dismissAllErrors = jest.fn();
    (useAddQueue as jest.Mock).mockReturnValue({
      pendingCount: 0,
      dismissedIds: new Set(),
      dismiss: jest.fn(),
      dismissAllErrors,
      retryJob: jest.fn(),
      retryAllFailed,
      jobs: [
        {
          id: 'j1',
          text: 'glorp',
          pos: 'Any',
          status: 'error',
          error: 'Not found',
          errorInfo: classifyAddError(new ApiError(404, 'not found', 'ADD-309', false)),
        },
        {
          id: 'j2',
          text: 'charge',
          pos: 'Any',
          status: 'error',
          error: 'Timed out',
          errorInfo: classifyAddError(new ApiError(504, 'timeout', 'ADD-405', true)),
        },
      ],
    });

    await render(<QueueBanner />, { wrapper: Wrapper });

    expect(screen.getByTestId('queue-grouped-error')).toBeTruthy();
    expect(screen.getByText('2 words could not be added')).toBeTruthy();
    expect(screen.queryByText(/glorp · Not in dictionary/)).toBeNull();

    await fireEvent.press(screen.getByTestId('queue-toggle-details'));
    await waitFor(() => {
      expect(screen.getByText(/glorp · Not in dictionary \(ADD-309\)/)).toBeTruthy();
      expect(screen.getByText(/charge · Lookup timed out \(ADD-405\)/)).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('queue-retry-failed'));
    expect(retryAllFailed).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('queue-dismiss-all'));
    expect(dismissAllErrors).toHaveBeenCalled();
  });
});
