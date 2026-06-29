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

  it('renders the passage capture form with only Step 1 visible initially', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy();
    expect(screen.getByText('From a passage')).toBeTruthy();

    // Step 2 and 3 should be hidden
    expect(screen.queryByText('Tap words to select')).toBeNull();
    expect(screen.queryByText('Part of speech (optional)')).toBeNull();
  });

  it('shows Step 2 (tappable words) only when text is entered', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    expect(screen.queryByText('Tap words to select')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'hello');
    await waitFor(() => expect(screen.getByText('Tap words to select')).toBeTruthy());
    expect(screen.getByText('hello')).toBeTruthy();

    // Step 3 (POS, Add Button) is still hidden
    expect(screen.queryByText('Part of speech (optional)')).toBeNull();
    expect(screen.queryByText('Add selected (0)')).toBeNull();
  });

  it('shows Step 3 (POS, selected chips, Add button) only when at least one word is selected', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'fox dog');
    await waitFor(() => expect(screen.getByText('fox')).toBeTruthy());

    // Step 3 is hidden initially
    expect(screen.queryByText('Part of speech (optional)')).toBeNull();

    // Select 'fox'
    fireEvent.press(screen.getByText('fox'));

    // Step 3 should now be visible
    await waitFor(() => expect(screen.getByText('Part of speech (optional)')).toBeTruthy());
    expect(screen.getByText('Add selected (1)')).toBeTruthy();

    // Perform enqueue
    fireEvent.press(screen.getByText('Add selected (1)'));
    expect(enqueueMany).toHaveBeenCalledWith(['fox'], 'Any', 'deck-123');
  });
});
