import React, { ReactNode } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { AddScreen } from './AddScreen';
import { AddQueueProvider } from '../hooks/useAddQueue';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import * as decksApi from '../api/decks';

var mockUseActiveTargetLanguage = jest.fn();

jest.mock('../api/decks', () => ({
  listDecks: jest.fn(),
  createDeck: jest.fn(),
  renameDeck: jest.fn(),
  deleteDeck: jest.fn(),
}));

jest.mock('../hooks/useActiveTargetLanguage', () => ({
  useActiveTargetLanguage: (...args: any[]) => mockUseActiveTargetLanguage(...args),
}));

jest.mock('../api/words', () => ({
  addLearningItem: jest.fn().mockResolvedValue(undefined),
  lookupWord: jest.fn().mockResolvedValue({ sense_options: [] }),
}));

let focusCallback: (() => void) | null = null;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn((cb: any) => { focusCallback = cb; }),
}));

const mockedListDecks = jest.mocked(decksApi.listDecks);

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>
        <AddQueueProvider>{children}</AddQueueProvider>
      </ThemeProvider>
    </AppLanguageProvider>
  );
}

const enDecks = [
  { id: 'd1', name: 'All Words', is_default: true, target_language: 'en', item_count: 10, user_id: 'u1', created_at: '', updated_at: '' },
];

const esDecks = [
  { id: 'es-d1', name: 'Todas', is_default: true, target_language: 'es', item_count: 0, user_id: 'u1', created_at: '', updated_at: '' },
];

describe('AddScreen', () => {
  beforeEach(() => {
    focusCallback = null;
    mockUseActiveTargetLanguage.mockReturnValue({
      targetLanguage: 'en',
      displayLanguage: 'ko',
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockedListDecks.mockImplementation((languageCode) =>
      Promise.resolve(languageCode === 'es' ? esDecks : enDecks),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders segmented switcher and defaults to Manual Add tab', async () => {
    await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    // Segmented tab switchers should be present (Manual first)
    expect(screen.getByText('Manual Add')).toBeTruthy();
    expect(screen.getAllByText('From a passage').length).toBeGreaterThan(0);

    // Defaults to Manual Add flow — CI gate: must fail if default flips to passage
    expect(screen.getByPlaceholderText('Type a word or phrase')).toBeTruthy();
    expect(screen.getByTestId('manual-add-input-wrapper')).toBeTruthy();
    // Passage capture section should not be visible
    expect(screen.queryByPlaceholderText('Paste or type text here...')).toBeNull();
  });

  it('switches to From Passage tab when clicked', async () => {
    await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    // Click on From Passage tab
    const passageTab = screen.getByTestId('tab-passage');
    fireEvent.press(passageTab);

    // Passage capture flow should be visible
    await waitFor(() => expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy());
    // Manual add section should not be visible
    expect(screen.queryByPlaceholderText('Type a word or phrase')).toBeNull();

    // Click back to Manual Add tab
    const manualTab = screen.getByTestId('tab-manual');
    fireEvent.press(manualTab);

    // Manual add section should be visible again
    await waitFor(() => expect(screen.getByPlaceholderText('Type a word or phrase')).toBeTruthy());
    expect(screen.queryByPlaceholderText('Paste or type text here...')).toBeNull();
  });

  it('selects the default deck for the new language pair when the active target language changes', async () => {
    const { rerender } = await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('All Words')).toBeTruthy());
    expect(mockedListDecks).toHaveBeenLastCalledWith('en', 'private');

    // Switch active language pair to Spanish
    mockUseActiveTargetLanguage.mockReturnValue({
      targetLanguage: 'es',
      displayLanguage: 'en',
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    rerender(<AddScreen />);

    await waitFor(() => expect(screen.getByText('Todas')).toBeTruthy());
    expect(mockedListDecks).toHaveBeenLastCalledWith('es', 'private');
    expect(screen.queryByText('No deck')).toBeNull();
  });

  it('refreshes language on focus only when the threshold has passed', async () => {
    const refresh = jest.fn();
    mockUseActiveTargetLanguage.mockReturnValue({
      targetLanguage: 'en',
      displayLanguage: 'ko',
      loading: false,
      error: null,
      refresh,
    });

    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockReturnValue(1000);

    await render(<AddScreen />, { wrapper: Wrapper });
    expect(focusCallback).not.toBeNull();

    focusCallback!();
    expect(refresh).toHaveBeenCalledTimes(1);

    dateSpy.mockReturnValue(2000);
    focusCallback!();
    expect(refresh).toHaveBeenCalledTimes(1);

    dateSpy.mockReturnValue(40000);
    focusCallback!();
    expect(refresh).toHaveBeenCalledTimes(2);

    dateSpy.mockRestore();
  });
});
