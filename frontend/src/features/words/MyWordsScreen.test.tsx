import React, { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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

describe('MyWordsScreen', () => {
  beforeEach(() => {
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
  });

  it('shows the deck list and hides the Add Word button', async () => {
    await render(<MyWordsScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('All decks (0)')).toBeTruthy());
    expect(screen.getByText('Default (0)')).toBeTruthy();
    expect(screen.queryByText('Add Word')).toBeNull();
  });
});
