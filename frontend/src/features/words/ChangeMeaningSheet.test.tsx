import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { LearningItemListItem } from '../../types';
import { ChangeMeaningSheet } from './ChangeMeaningSheet';
import { changeLearningItemSense, lookupWord } from '../../api/words';

jest.mock('../../api/words', () => ({
  lookupWord: jest.fn(),
  changeLearningItemSense: jest.fn(),
}));

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
}));

const item: LearningItemListItem = {
  id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  language_code: 'en',
  lemma: 'charge',
  normalized_text: 'charge',
  pronunciation: null,
  part_of_speech: 'verb',
  definition: 'to accuse',
  short_definition: null,
  localized_definition: '기소하다',
  localized_short_definition: null,
  display_language_code: 'ko',
  cefr_level: null,
  meaning_order: 1,
  learning_stage: 'learning',
  due_at: '2026-07-01T00:00:00Z',
  added_at: '2026-06-20T00:00:00Z',
  examples: [],
};

describe('ChangeMeaningSheet', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    (lookupWord as jest.Mock).mockResolvedValue({
      sense_options: [
        {
          word_id: 'w-1',
          word_sense_id: 'ws-1',
          language_code: 'en',
          lemma: 'charge',
          normalized_text: 'charge',
          part_of_speech: 'verb',
          pronunciation: null,
          display_language_code: 'ko',
          definition: 'to accuse',
          short_definition: null,
          localized_definition: '기소하다',
          localized_short_definition: null,
          cefr_level: null,
          meaning_order: 1,
          examples: [],
        },
        {
          word_id: 'w-1',
          word_sense_id: 'ws-2',
          language_code: 'en',
          lemma: 'charge',
          normalized_text: 'charge',
          part_of_speech: 'verb',
          pronunciation: null,
          display_language_code: 'ko',
          definition: 'to store energy',
          short_definition: null,
          localized_definition: '충전하다',
          localized_short_definition: null,
          cefr_level: null,
          meaning_order: 2,
          examples: [],
        },
      ],
    });
    (changeLearningItemSense as jest.Mock).mockResolvedValue({
      id: 'uws-1',
      word_sense_id: 'ws-2',
      learning_stage: 'learning',
      due_at: '2026-07-01T00:00:00Z',
    });
  });

  it('loads senses and PATCHes the selected meaning without changing due_at', async () => {
    const onChanged = jest.fn();
    await render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 375, height: 812 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>
            <ChangeMeaningSheet visible item={item} onClose={jest.fn()} onChanged={onChanged} />
          </ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    fireEvent.press(screen.getByText('충전하다'));
    await waitFor(() => {
      expect(screen.getByText('Save meaning')).not.toBeDisabled();
    });
    fireEvent.press(screen.getByText('Save meaning'));

    await waitFor(() => {
      expect(changeLearningItemSense).toHaveBeenCalled();
    });
    expect(changeLearningItemSense).toHaveBeenCalledWith('uws-1', 'ws-2');
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          word_sense_id: 'ws-2',
          due_at: '2026-07-01T00:00:00Z',
          learning_stage: 'learning',
        }),
      );
    });
  });

  it('finds more senses with force lookup when context is set', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 375, height: 812 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>
            <ChangeMeaningSheet visible item={item} onClose={jest.fn()} onChanged={jest.fn()} />
          </ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    const contextInput = screen.getByPlaceholderText(/Optional sentence/);
    fireEvent.changeText(contextInput, 'Please charge the invoice today.');
    await waitFor(() => expect(contextInput.props.value).toBe('Please charge the invoice today.'));
    fireEvent.press(screen.getByText('Find more senses'));

    await waitFor(() => {
      expect(lookupWord).toHaveBeenCalledWith(
        'charge',
        expect.objectContaining({
          force: true,
          wordId: 'w-1',
          sourceContext: 'Please charge the invoice today.',
        }),
      );
    });
  });

  it('does not force lookup when context is empty', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 375, height: 812 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>
            <ChangeMeaningSheet visible item={item} onClose={jest.fn()} onChanged={jest.fn()} />
          </ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    (lookupWord as jest.Mock).mockClear();
    fireEvent.press(screen.getByText('Find more senses'));
    await waitFor(() => {
      expect(screen.getByText(/Add a sentence that shows the meaning/)).toBeTruthy();
    });
    expect(lookupWord).not.toHaveBeenCalled();
  });
});
