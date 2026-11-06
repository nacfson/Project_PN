import React, { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as decksApi from '../../api/decks';
import * as learningItemsApi from '../../api/learningItems';
import * as useActiveTargetLanguageHook from '../../hooks/useActiveTargetLanguage';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { LearningItemListItem } from '../../types';
import { MyWordsScreen } from './MyWordsScreen';
import * as useLearningItemsHook from './useLearningItems';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: jest.fn(),
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue(null),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../hooks/useActiveTargetLanguage');
jest.mock('./useLearningItems');
jest.mock('../../api/decks');
jest.mock('../../api/learningItems');

const mockedUseActiveTargetLanguage = jest.mocked(
  useActiveTargetLanguageHook.useActiveTargetLanguage,
);
const mockedUseLearningItems = jest.mocked(useLearningItemsHook.useLearningItems);
const mockedListDecks = jest.mocked(decksApi.listDecks);
const mockedMoveItemsToDeck = jest.mocked(decksApi.moveItemsToDeck);
const mockedArchiveLearningItem = jest.mocked(learningItemsApi.archiveLearningItem);
const mockedArchiveLearningItems = jest.mocked(learningItemsApi.archiveLearningItems);

function createWrapper(width = 1024) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width, height: 812 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>
    );
  };
}

const defaultDeck = {
  id: 'd1',
  name: 'Default',
  target_language: 'en',
  is_default: true,
  item_count: 10,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

const secondDeck = {
  id: 'd2',
  name: 'Work & Tech',
  target_language: 'en',
  is_default: false,
  item_count: 6,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

const sampleItems: LearningItemListItem[] = [
  {
    id: 'uws-1',
    word_sense_id: 'ws-1',
    word_id: 'w-1',
    language_code: 'en',
    lemma: 'latency',
    pronunciation: '/ˈleɪ.tən.si/',
    part_of_speech: 'noun',
    definition: 'delay before a transfer of data begins',
    short_definition: 'delay',
    localized_definition: '지연 시간',
    localized_short_definition: '지연 시간',
    cefr_level: 'C1',
    meaning_order: 1,
    learning_stage: 'new',
    due_at: '2026-06-28T00:00:00Z',
    added_at: '2026-06-20T00:00:00Z',
    deck_id: 'd1',
    deck_name: 'Default',
    last_reviewed_at: null,
    examples: [],
  },
  {
    id: 'uws-2',
    word_sense_id: 'ws-2',
    word_id: 'w-2',
    language_code: 'en',
    lemma: 'discipline',
    pronunciation: '/ˈdɪs.ə.plɪn/',
    part_of_speech: 'noun',
    definition: 'controlled behavior',
    short_definition: 'self-control',
    localized_definition: '절제, 규율',
    localized_short_definition: '절제',
    cefr_level: 'B2',
    meaning_order: 1,
    learning_stage: 'learning',
    due_at: '2026-06-29T00:00:00Z',
    added_at: '2026-06-20T00:00:00Z',
    deck_id: 'd2',
    deck_name: 'Work & Tech',
    last_reviewed_at: null,
    examples: [],
  },
];

let originalPlatform: string;

describe('MyWordsScreen', () => {
  beforeAll(() => {
    originalPlatform = Platform.OS;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });

    mockedUseActiveTargetLanguage.mockReturnValue({
      targetLanguage: 'en',
      displayLanguage: 'ko',
      loading: false,
      error: null,
      refresh: jest.fn(),
      removeItemsLocally: jest.fn(),
    });
    mockedUseLearningItems.mockReturnValue({
      items: sampleItems,
      nextCursor: null,
      hasMore: false,
      status: 'ready',
      isSearching: false,
      isLoadingMore: false,
      isRefreshing: false,
      error: null,
      loadMore: jest.fn(),
      maybeLoadMoreFromScroll: jest.fn(),
      refresh: jest.fn(),
      removeItemsLocally: jest.fn(),
    });
    mockedListDecks.mockResolvedValue([defaultDeck, secondDeck]);
    mockedArchiveLearningItem.mockResolvedValue(undefined);
    mockedArchiveLearningItems.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanup();
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });
  });

  it('renders header summary "{n} words in {m} decks", deck filter, and "New deck" without inline DeckCanvas', async () => {
    await render(<MyWordsScreen />, { wrapper: createWrapper(1024) });

    await waitFor(() => {
      expect(screen.getByText('Words')).toBeTruthy();
      expect(screen.getByTestId('words-summary').props.children).toBe('16 words in 2 decks');
    });
    expect(screen.getByTestId('deck-filter-trigger')).toBeTruthy();
    expect(screen.getByTestId('words-new-deck')).toBeTruthy();
    // Inline DeckCanvas card counts are no longer rendered directly on the page
    expect(screen.queryByText('10 cards')).toBeNull();
  });

  it('renders stage tabs with All plus six stages and counts, with accessibilityState.selected on the active tab', async () => {
    await render(<MyWordsScreen />, { wrapper: createWrapper(1024) });

    await waitFor(() => expect(screen.getByTestId('stage-tab-all')).toBeTruthy());

    const allTab = screen.getByTestId('stage-tab-all');
    const newTab = screen.getByTestId('stage-tab-new');
    const learningTab = screen.getByTestId('stage-tab-learning');
    expect(allTab.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(newTab.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(screen.getByTestId('stage-tab-recognized')).toBeTruthy();
    expect(screen.getByTestId('stage-tab-recalled')).toBeTruthy();
    expect(screen.getByTestId('stage-tab-usable')).toBeTruthy();
    expect(screen.getByTestId('stage-tab-mastered')).toBeTruthy();

    await fireEvent.press(newTab);
    expect(screen.getByTestId('stage-tab-new').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByText('latency')).toBeTruthy();
    expect(screen.queryByText('discipline')).toBeNull();

    await fireEvent.press(learningTab);
    expect(screen.getByText('discipline')).toBeTruthy();
    expect(screen.queryByText('latency')).toBeNull();
  });

  it('preselects the deck when a deckId route param is provided and navigates to Decks from Manage decks', async () => {
    await render(<MyWordsScreen route={{ params: { deckId: 'd2' } }} />, {
      wrapper: createWrapper(1024),
    });

    await waitFor(() => {
      expect(mockedUseLearningItems).toHaveBeenCalledWith('', 'd2', true, 'en');
    });

    await fireEvent.press(screen.getByTestId('deck-filter-trigger'));
    await fireEvent.press(screen.getByTestId('deck-filter-manage-decks'));
    expect(mockNavigate).toHaveBeenCalledWith('Decks');
  });

  it('focuses the search input when "/" is pressed on web', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true });
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const origWin = (globalThis as any).window;
    (globalThis as any).window = {
      ...origWin,
      innerHeight: 800,
      addEventListener: (type: string, fn: (e: any) => void) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: (e: any) => void) => {
        listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
      },
    };

    try {
      const { unmount } = await render(<MyWordsScreen />, { wrapper: createWrapper(1024) });
      await waitFor(() => expect(screen.getByTestId('words-search-input')).toBeTruthy());

      const preventDefault = jest.fn();
      for (const fn of listeners.keydown || []) {
        fn({
          key: '/',
          preventDefault,
          target: { tagName: 'DIV' },
        });
      }
      expect(preventDefault).toHaveBeenCalled();
      await unmount();
    } finally {
      (globalThis as any).window = origWin;
    }
  });

  it('renders only Word and Stage columns when page width is below 720 px, and all columns when >= 720 px', async () => {
    await render(<MyWordsScreen />, { wrapper: createWrapper(400) });

    await waitFor(() => expect(screen.getByText('latency')).toBeTruthy());
    await fireEvent(screen.getByTestId('words-header'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 160 } },
    });

    expect(screen.getByTestId('word-stage-uws-1')).toBeTruthy();
    expect(screen.queryByTestId('word-gloss-uws-1')).toBeNull();
    expect(screen.queryByTestId('word-type-uws-1')).toBeNull();
    expect(screen.queryByTestId('word-due-uws-1')).toBeNull();

    await fireEvent(screen.getByTestId('words-header'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 900, height: 160 } },
    });

    expect(screen.getByTestId('word-gloss-uws-1')).toBeTruthy();
    expect(screen.getByTestId('word-type-uws-1')).toBeTruthy();
    expect(screen.getByTestId('word-due-uws-1')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('word-gloss-uws-1').props.style),
    ).toEqual(expect.objectContaining({ flexShrink: 1 }));
  });

  it('moves a word to another deck from its row action', async () => {
    mockedMoveItemsToDeck.mockResolvedValue(undefined);
    await render(<MyWordsScreen />, { wrapper: createWrapper(1024) });

    await waitFor(() => expect(screen.getByText('latency')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('word-move-uws-1'));

    await waitFor(() => expect(screen.getByTestId('move-to-deck-option-d2')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('move-to-deck-option-d2'));

    await waitFor(() => {
      expect(mockedMoveItemsToDeck).toHaveBeenCalledWith('d2', ['uws-1']);
    });
  });

  it('guards single-word and bulk removal with ConfirmDialog: Cancel does not archive, Remove archives once', async () => {
    const removeItemsLocally = jest.fn();
    mockedUseLearningItems.mockReturnValue({
      items: sampleItems,
      nextCursor: null,
      hasMore: false,
      status: 'ready',
      isSearching: false,
      isLoadingMore: false,
      isRefreshing: false,
      error: null,
      loadMore: jest.fn(),
      maybeLoadMoreFromScroll: jest.fn(),
      refresh: jest.fn(),
      removeItemsLocally,
    });

    await render(<MyWordsScreen />, { wrapper: createWrapper(1024) });
    await waitFor(() => expect(screen.getByText('latency')).toBeTruthy());

    // 1. Single-row remove -> Cancel
    await fireEvent.press(screen.getByTestId('word-remove-uws-1'));
    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
    expect(screen.getByText('Remove this word?')).toBeTruthy();
    expect(screen.getByText("This can't be undone.")).toBeTruthy();

    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(mockedArchiveLearningItem).not.toHaveBeenCalled();
    expect(removeItemsLocally).not.toHaveBeenCalled();

    // 2. Single-row remove -> Confirm
    await fireEvent.press(screen.getByTestId('word-remove-uws-1'));
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => {
      expect(mockedArchiveLearningItem).toHaveBeenCalledTimes(1);
      expect(mockedArchiveLearningItem).toHaveBeenCalledWith('uws-1');
    });

    // 3. Bulk remove -> shows count, Cancel does not call archiveLearningItems, Confirm calls it once
    await fireEvent(screen.getByTestId('word-row-uws-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('word-row-uws-2'));
    await fireEvent.press(screen.getByText('Remove from deck'));

    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
    expect(screen.getByText('Remove 2 words?')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(mockedArchiveLearningItems).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Remove from deck'));
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => {
      expect(mockedArchiveLearningItems).toHaveBeenCalledTimes(1);
      expect(mockedArchiveLearningItems).toHaveBeenCalledWith(['uws-1', 'uws-2']);
    });
  });
});
