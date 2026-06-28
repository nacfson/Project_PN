import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MyWordsScreen } from './MyWordsScreen';
import * as useActiveTargetLanguageHook from '../../hooks/useActiveTargetLanguage';
import * as useLearningItemsHook from './useLearningItems';
import * as decksApi from '../../api/decks';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../../hooks/useActiveTargetLanguage');
jest.mock('./useLearningItems');
jest.mock('../../api/decks');

const mockedUseActiveTargetLanguage = jest.mocked(useActiveTargetLanguageHook.useActiveTargetLanguage);
const mockedUseLearningItems = jest.mocked(useLearningItemsHook.useLearningItems);
const mockedListDecks = jest.mocked(decksApi.listDecks);

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

const defaultDeck = {
  id: 'd1',
  name: 'Default',
  target_language: 'en',
  is_default: true,
  item_count: 0,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

// Store original platform to restore between web tests
let originalPlatform: string;

describe('MyWordsScreen', () => {
  beforeAll(() => {
    originalPlatform = Platform.OS;
    // Mock window for InspectorPanel's web-only addEventListener
    if (typeof window === 'undefined') {
      (global as any).window = {};
    }
    if (!window.addEventListener) {
      window.addEventListener = jest.fn();
      window.removeEventListener = jest.fn();
    }
  });

  beforeEach(() => {
    // Reset platform to default before each test
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
    });
    mockedUseLearningItems.mockReturnValue({
      items: [],
      nextCursor: null,
      status: 'ready',
      isLoadingMore: false,
      isRefreshing: false,
      error: null,
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });
    mockedListDecks.mockResolvedValue([defaultDeck]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Ensure platform is restored
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });
  });

  it('shows deck canvas tiles and hides the Add Word button', async () => {
    await render(<MyWordsScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Default')).toBeTruthy());
    expect(screen.getByText('0 cards')).toBeTruthy();
    expect(screen.queryByText('Add Word')).toBeNull();
  });

  it('shows contextual command bar when decks are selected on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    await render(<MyWordsScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Default')).toBeTruthy());

    // Tap the deck card to select it on web
    const deckCard = screen.getByText('Default');
    fireEvent.press(deckCard);

    // Command bar should show selected count
    await waitFor(() => expect(screen.getByText('1 selected')).toBeTruthy());

    // Clear selection
    const clearButton = screen.getByTestId('command-bar-clear');
    fireEvent.press(clearButton);

    await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  });

  it('opens inspector panel when info circle icon is pressed on deck canvas tile (web)', async () => {
    jest.spyOn(Platform, 'OS', 'get').mockReturnValue('web');

    const { container } = await render(<MyWordsScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Default')).toBeTruthy());

    // Find the info icon Text element via its icon name string child
    const infoIcons = container.queryAll(
      (el) => el.type === 'Text' && el.props.children === 'information-circle-outline',
    );
    expect(infoIcons.length).toBeGreaterThanOrEqual(1);

    // Press the icon — fireEvent walks up the fiber tree to find the onPress handler
    fireEvent.press(infoIcons[0]);

    await waitFor(() => expect(screen.getByText('Rename deck')).toBeTruthy());
  });

  it('shows loading indicator when decks are loading', async () => {
    mockedListDecks.mockReturnValue(new Promise(() => {}));

    await render(<MyWordsScreen />, { wrapper: Wrapper });

    // Deck listing should show the heading without deck canvas (still loading)
    await waitFor(() => expect(screen.getByText('My Words')).toBeTruthy());
    // Deck canvas is not rendered when loading - "Default" is not visible
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('shows error state when deck loading fails', async () => {
    mockedListDecks.mockRejectedValue(new Error('Failed to load'));

    await render(<MyWordsScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Failed to load')).toBeTruthy());
  });
});
