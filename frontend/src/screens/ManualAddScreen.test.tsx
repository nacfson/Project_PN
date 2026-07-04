import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ManualAddScreen } from './ManualAddScreen';
import { useAddQueue } from '../hooks/useAddQueue';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

const mockEnqueue = jest.fn();
const mockStatusOf = jest.fn().mockReturnValue('idle');

jest.mock('../hooks/useAddQueue', () => ({
  ...jest.requireActual('../hooks/useAddQueue'),
  useAddQueue: jest.fn(),
}));

jest.mock('../hooks/useActiveTargetLanguage', () => ({
  useActiveTargetLanguage: () => ({
    targetLanguage: 'zh',
    displayLanguage: 'ko',
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('ManualAddScreen', () => {
  beforeEach(() => {
    mockEnqueue.mockClear();
    (useAddQueue as jest.Mock).mockReturnValue({
      enqueue: mockEnqueue,
      statusOf: mockStatusOf,
    });
  });

  it('passes active targetLanguage to enqueue', async () => {
    await render(<ManualAddScreen />, { wrapper: Wrapper });

    const input = screen.getByPlaceholderText('Type a word');

    await act(async () => {
      fireEvent.changeText(input, '你好');
    });

    const button = screen.getByText('Look up');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnqueue).toHaveBeenCalledWith(
      '你好',
      'Any',
      undefined,
      'zh',
    );
  });
});
