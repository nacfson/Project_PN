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

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
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

  it('renders segmented switcher and defaults to From Passage tab', async () => {
    await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    // Segmented tab switchers should be present
    expect(screen.getAllByText('From a passage').length).toBeGreaterThan(0);
    expect(screen.getByText('Manual Add')).toBeTruthy();

    // Defaults to From Passage capture flow
    expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy();
    // Manual add section should not be visible
    expect(screen.queryByPlaceholderText('Type a word')).toBeNull();
  });

  it('switches to Manual Add tab when clicked', async () => {
    await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    // Click on Manual Add tab
    const manualTab = screen.getByTestId('tab-manual');
    fireEvent.press(manualTab);

    // Manual add section should be visible
    await waitFor(() => expect(screen.getByPlaceholderText('Type a word')).toBeTruthy());
    // Passage capture flow should not be visible
    expect(screen.queryByPlaceholderText('Paste or type text here...')).toBeNull();

    // Click back to From Passage tab
    const passageTab = screen.getByTestId('tab-passage');
    fireEvent.press(passageTab);

    // Passage capture flow should be visible again
    await waitFor(() => expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy());
    expect(screen.queryByPlaceholderText('Type a word')).toBeNull();
  });

  it('selects the default deck for the new language pair when the active target language changes', async () => {
    const { rerender } = await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('All Words')).toBeTruthy());
    expect(mockedListDecks).toHaveBeenLastCalledWith('en');

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
    expect(mockedListDecks).toHaveBeenLastCalledWith('es');
    expect(screen.queryByText('No deck')).toBeNull();
  });
});
