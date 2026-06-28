import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useAddQueue } from '../../hooks/useAddQueue';
import { CaptureSection } from './CaptureSection';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

const enqueueMany = jest.fn();
const statusOf = jest.fn().mockReturnValue('idle');

jest.mock('../../hooks/useAddQueue', () => ({
  ...jest.requireActual('../../hooks/useAddQueue'),
  useAddQueue: jest.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('CaptureSection', () => {
  beforeEach(() => {
    enqueueMany.mockClear();
    statusOf.mockReturnValue('idle');
    (useAddQueue as jest.Mock).mockReturnValue({ enqueueMany, statusOf });
  });

  it('renders the passage capture form', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy();
    expect(screen.getByText('From a passage')).toBeTruthy();
  });

  it('enqueues selected words with the provided deck id', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'fox dog');
    await waitFor(() => expect(screen.getByText('fox')).toBeTruthy());
    fireEvent.press(screen.getByText('fox'));
    await waitFor(() => expect(screen.getByText('Add selected (1)')).toBeTruthy());
    fireEvent.press(screen.getByText('Add selected (1)'));

    expect(enqueueMany).toHaveBeenCalledWith(['fox'], 'Any', 'deck-123');
  });
});
