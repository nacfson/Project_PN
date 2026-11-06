import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createDeck, deleteDeck, listDecks, renameDeck } from '../../api/decks';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { Deck } from '../../types';
import { DecksScreen } from './DecksScreen';

jest.mock('../../api/decks', () => ({
  listDecks: jest.fn(),
  createDeck: jest.fn(),
  renameDeck: jest.fn(),
  deleteDeck: jest.fn(),
}));

jest.mock('../../hooks/useActiveTargetLanguage', () => ({
  useActiveTargetLanguage: () => ({
    targetLanguage: 'en',
    displayLanguage: 'ko',
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue(null),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

const mockDecks: Deck[] = [
  {
    id: 'deck-default',
    user_id: 'u1',
    name: 'Default',
    target_language: 'en',
    is_default: true,
    item_count: 10,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'deck-work',
    user_id: 'u1',
    name: 'Work & Tech',
    target_language: 'en',
    is_default: false,
    item_count: 6,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

describe('DecksScreen', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (listDecks as jest.Mock).mockResolvedValue(mockDecks);
    (createDeck as jest.Mock).mockImplementation(async (name: string) => ({
      id: 'deck-new',
      user_id: 'u1',
      name,
      target_language: 'en',
      is_default: false,
      item_count: 0,
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    }));
    (renameDeck as jest.Mock).mockResolvedValue(undefined);
    (deleteDeck as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanup();
  });

  const renderScreen = async () =>
    render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 1024, height: 768 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>
            <DecksScreen
              navigation={{ navigate: mockNavigate } as any}
              route={{ key: 'Decks', name: 'Decks', params: undefined } as any}
            />
          </ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

  it('lists decks with word counts and navigates to WordsRoot with deckId when opened', async () => {
    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeTruthy();
      expect(screen.getByText('10 cards')).toBeTruthy();
      expect(screen.getByText('Work & Tech')).toBeTruthy();
      expect(screen.getByText('6 cards')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('deck-row-deck-work'));
    expect(mockNavigate).toHaveBeenCalledWith('WordsRoot', { deckId: 'deck-work' });
  });

  it('creates a deck via DeckFormModal', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Default')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('decks-create-button'));
    const input = screen.getByPlaceholderText('Deck name');
    await fireEvent.changeText(input, 'Reading');
    const submitButtons = screen.getAllByText('New deck');
    await fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(createDeck).toHaveBeenCalledWith('Reading', 'en');
      expect(screen.getByText('Reading')).toBeTruthy();
    });
  });

  it('renames a deck via DeckFormModal', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Work & Tech')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('deck-rename-deck-work'));
    const input = screen.getByPlaceholderText('Deck name');
    await fireEvent.changeText(input, 'Engineering');
    const renameButtons = screen.getAllByText('Rename deck');
    await fireEvent.press(renameButtons[renameButtons.length - 1]);

    await waitFor(() => {
      expect(renameDeck).toHaveBeenCalledWith('deck-work', 'Engineering');
      expect(screen.getByText('Engineering')).toBeTruthy();
    });
  });

  it('hides delete for the default deck and calls deleteDeck for non-default decks', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Default')).toBeTruthy());

    expect(screen.queryByTestId('deck-delete-deck-default')).toBeNull();
    expect(screen.getByTestId('deck-delete-deck-work')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('deck-delete-deck-work'));
    await waitFor(() => {
      expect(deleteDeck).toHaveBeenCalledWith('deck-work');
      expect(screen.queryByText('Work & Tech')).toBeNull();
    });
  });
});
