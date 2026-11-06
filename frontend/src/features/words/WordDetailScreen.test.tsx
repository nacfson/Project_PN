import React, { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { archiveLearningItem } from '../../api/learningItems';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { LearningItemListItem } from '../../types';
import { WordDetailScreen } from './WordDetailScreen';

jest.mock('../../api/decks', () => ({
  listDecks: jest.fn().mockResolvedValue([]),
  moveItemsToDeck: jest.fn(),
}));

jest.mock('../../api/learningItems', () => ({
  archiveLearningItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue(null),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

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

const baseItem: LearningItemListItem = {
  id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  language_code: 'en',
  lemma: 'abandon',
  normalized_text: 'abandon',
  pronunciation: '/əˈbændən/',
  part_of_speech: 'verb',
  display_language_code: 'ko',
  definition: 'to leave behind, to forsake',
  short_definition: 'leave behind',
  localized_definition: '떠나다, 버리다',
  localized_short_definition: '떠나다',
  cefr_level: 'B2',
  meaning_order: 1,
  learning_stage: 'learning',
  due_at: '2026-06-28T00:00:00Z',
  added_at: '2026-06-20T00:00:00Z',
  examples: [
    {
      sentence: 'He abandoned his car in the snow.',
      difficulty: 'B2',
      localized_translation: '그는 눈 속에서 차를 버려두었다.',
    },
  ],
};

const mockRoute = (item: LearningItemListItem) =>
  ({
    params: { item },
    key: 'WordDetail-test',
    name: 'WordDetail',
  }) as const;

describe('WordDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renders the lemma and chosen gloss only', async () => {
    await render(<WordDetailScreen route={mockRoute(baseItem) as any} navigation={{} as any} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(screen.getByText('abandon')).toBeTruthy());
    expect(screen.getByText('떠나다')).toBeTruthy();
    expect(screen.getByText('CEFR B2')).toBeTruthy();
    expect(screen.queryByText('Explanation')).toBeNull();
    expect(screen.queryByText('to leave behind, to forsake')).toBeNull();
    expect(screen.queryByText('Full meaning')).toBeNull();
    expect(screen.queryByText('He abandoned his car in the snow.')).toBeNull();
  });

  it('renders with minimal data (no optional fields)', async () => {
    const minimalItem: LearningItemListItem = {
      ...baseItem,
      pronunciation: null,
      short_definition: null,
      localized_short_definition: null,
      cefr_level: null,
      examples: [],
    };

    await render(
      <WordDetailScreen route={mockRoute(minimalItem) as any} navigation={{} as any} />,
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(screen.getByText('abandon')).toBeTruthy());
    expect(screen.getByText('떠나다, 버리다')).toBeTruthy();
  });

  it('renders when backend returns examples as null', async () => {
    const nullExamplesItem = {
      ...baseItem,
      examples: null,
    } as unknown as LearningItemListItem;

    await render(
      <WordDetailScreen route={mockRoute(nullExamplesItem) as any} navigation={{} as any} />,
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(screen.getByText('abandon')).toBeTruthy());
    expect(screen.getByText('떠나다')).toBeTruthy();
  });

  it('shows Wiktionary attribution with the gloss', async () => {
    await render(<WordDetailScreen route={mockRoute(baseItem) as any} navigation={{} as any} />, {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(screen.getByText('abandon')).toBeTruthy());
    expect(screen.getByText('떠나다')).toBeTruthy();
    expect(screen.getByText('Gloss via Wiktionary')).toBeTruthy();
  });

  it('guards remove with ConfirmDialog: Cancel does not archive and Remove archives once', async () => {
    const goBack = jest.fn();
    await render(
      <WordDetailScreen route={mockRoute(baseItem) as any} navigation={{ goBack } as any} />,
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(screen.getByTestId('word-detail-remove')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('word-detail-remove'));
    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
    expect(screen.getByText('Remove this word?')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(archiveLearningItem).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('word-detail-remove'));
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => {
      expect(archiveLearningItem).toHaveBeenCalledTimes(1);
      expect(archiveLearningItem).toHaveBeenCalledWith('uws-1');
      expect(goBack).toHaveBeenCalledTimes(1);
    });
  });
});
