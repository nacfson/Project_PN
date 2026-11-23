import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { useAddQueue } from '../../hooks/useAddQueue';
import { CaptureSection } from './CaptureSection';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { classifyAddError } from '../../utils/addErrors';

const enqueueMany = jest.fn();
const statusOf = jest.fn().mockReturnValue('idle');
const markManualAdded = jest.fn();

jest.mock('../../hooks/useAddQueue', () => ({
  ...jest.requireActual('../../hooks/useAddQueue'),
  useAddQueue: jest.fn(),
}));

jest.mock('../../api/words', () => ({
  addLearningItem: jest.fn().mockResolvedValue({ id: 'item-1', word_sense_id: 'sense-1' }),
  addManualLearningItem: jest.fn().mockResolvedValue({ id: 'item-m1', word_sense_id: 'sense-m1' }),
  lookupWord: jest.fn().mockResolvedValue({ sense_options: [] }),
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
    markManualAdded.mockClear();
    statusOf.mockReturnValue('idle');
    (useAddQueue as jest.Mock).mockReturnValue({ enqueueMany, statusOf, jobs: [], markManualAdded });
  });

  it('renders the passage capture form with only Step 1 visible initially', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy();
    expect(screen.getAllByText('From a passage').length).toBeGreaterThan(0);

    expect(screen.queryByText('Tap words to select')).toBeNull();
    expect(screen.queryByText('Part of speech (optional)')).toBeNull();
  });

  it('shows Step 2 (tappable words) only when text is entered', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    expect(screen.queryByText('Tap words to select')).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'hello');
    await waitFor(() => expect(screen.getByText('Tap words to select')).toBeTruthy());
    expect(screen.getByText('hello')).toBeTruthy();

    expect(screen.queryByText('Part of speech (optional)')).toBeNull();
    expect(screen.queryByText('Add selected (0)')).toBeNull();
  });

  it('shows Step 3 (POS, selected chips, Add button) only when at least one word is selected', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    await fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'fox dog');
    await waitFor(() => expect(screen.getByText('fox')).toBeTruthy());

    expect(screen.queryByText('Part of speech (optional)')).toBeNull();

    await fireEvent.press(screen.getByText('fox'));

    await waitFor(() => expect(screen.getByText('Part of speech (optional)')).toBeTruthy());
    expect(screen.getByText('Add selected (1)')).toBeTruthy();

    await fireEvent.press(screen.getByText('Add selected (1)'));
    expect(enqueueMany).toHaveBeenCalledWith(['fox'], 'Any', 'deck-123', 'en', { fox: 'fox dog' });
  });

  it('selects a multi-word phrase in phrase mode', async () => {
    await render(<CaptureSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    await fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'look up the word');
    await waitFor(() => expect(screen.getByTestId('passage-word-0')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('phrase-mode-toggle'));
    await waitFor(() => expect(screen.getByText('Tap start and end words to select a phrase')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('passage-word-0'));
    await fireEvent.press(screen.getByTestId('passage-word-1'));

    await waitFor(() => expect(screen.getByText('Add selected (1)')).toBeTruthy());
    await fireEvent.press(screen.getByText('Add selected (1)'));
    expect(enqueueMany).toHaveBeenCalledWith(['look up'], 'phrase', 'deck-123', 'en', {
      'look up': 'look up the word',
    });
  });

  it('opens SensePicker manual fallback when tapping a failed WordChip', async () => {
    const errorInfo = classifyAddError(new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'));
    statusOf.mockImplementation((text: string) => (text === 'glorp' ? 'error' : 'idle'));
    (useAddQueue as jest.Mock).mockReturnValue({
      enqueueMany,
      statusOf,
      markManualAdded,
      jobs: [
        {
          id: 'job-1',
          text: 'glorp',
          pos: 'Any',
          sourceContext: 'The glorp glowed.',
          status: 'error',
          error: "We couldn't find this word in the dictionary.",
          errorInfo,
        },
      ],
    });

    await render(<CaptureSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByPlaceholderText('Paste or type text here...'), 'The glorp glowed.');
    await waitFor(() => expect(screen.getByTestId('passage-word-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('passage-word-1'));
    await waitFor(() => expect(screen.getByText(/Tap a failed word chip/)).toBeTruthy());

    await fireEvent.press(screen.getByTestId('word-chip-glorp'));
    await waitFor(() => expect(screen.getByTestId('sense-manual-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('sense-manual-input'), '빛나는 것');
    await fireEvent.press(screen.getByTestId('sense-save-manual'));

    await waitFor(() => {
      expect(markManualAdded).toHaveBeenCalledWith('glorp', 'sense-m1');
    });
  });
});
