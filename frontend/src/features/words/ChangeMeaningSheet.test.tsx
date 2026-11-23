import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { LearningItemListItem } from '../../types';
import { ChangeMeaningSheet } from './ChangeMeaningSheet';
import { changeLearningItemSense, lookupWord, setLearningItemPersonalNote } from '../../api/words';

jest.mock('../../api/words', () => ({
  lookupWord: jest.fn(),
  changeLearningItemSense: jest.fn(),
  setLearningItemPersonalNote: jest.fn(),
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

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderSheet(
  props: Partial<React.ComponentProps<typeof ChangeMeaningSheet>> = {},
) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      <AppLanguageProvider>
        <ThemeProvider>
          <ChangeMeaningSheet
            visible
            item={item}
            onClose={jest.fn()}
            onChanged={jest.fn()}
            {...props}
          />
        </ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>,
  );
}

describe('ChangeMeaningSheet', () => {
  afterEach(async () => {
    await flushAsync();
    await cleanup();
  });

  beforeEach(() => {
    (lookupWord as jest.Mock).mockReset();
    (changeLearningItemSense as jest.Mock).mockReset();
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
      personal_note: null,
    });
    (setLearningItemPersonalNote as jest.Mock).mockReset();
  });

  it('loads senses and PATCHes the selected meaning without changing due_at', async () => {
    const onChanged = jest.fn();
    const onClose = jest.fn();
    await renderSheet({ onChanged, onClose });

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    await fireEvent.press(screen.getByText('충전하다'));
    await waitFor(() => {
      expect(screen.getByText('Save meaning')).not.toBeDisabled();
    });
    await fireEvent.press(screen.getByText('Save meaning'));

    await waitFor(() => {
      expect(changeLearningItemSense).toHaveBeenCalled();
    });
    expect(changeLearningItemSense).toHaveBeenCalledWith('uws-1', 'ws-2', undefined, undefined);
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          word_sense_id: 'ws-2',
          due_at: '2026-07-01T00:00:00Z',
          learning_stage: 'learning',
          personal_note: null,
        }),
      );
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await flushAsync();
  });

  it('finds more senses with force lookup when context is set', async () => {
    await renderSheet();

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    const contextInput = screen.getByPlaceholderText(/Optional sentence/);
    await fireEvent.changeText(contextInput, 'Please charge the invoice today.');
    await waitFor(() => expect(contextInput.props.value).toBe('Please charge the invoice today.'));
    await fireEvent.press(screen.getByText('Find more senses'));

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
    await flushAsync();
  });

  it('does not force lookup when context is empty', async () => {
    await renderSheet();

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    (lookupWord as jest.Mock).mockClear();
    await fireEvent.press(screen.getByText('Find more senses'));
    await waitFor(() => {
      expect(screen.getByText(/Add a sentence that shows the meaning/)).toBeTruthy();
    });
    expect(lookupWord).not.toHaveBeenCalled();
    await flushAsync();
  });

  it('saves a personal meaning via setLearningItemPersonalNote', async () => {
    (setLearningItemPersonalNote as jest.Mock).mockResolvedValue({
      id: 'uws-1',
      word_sense_id: 'ws-1',
      learning_stage: 'learning',
      due_at: '2026-07-01T00:00:00Z',
      personal_note: '청구하다',
    });
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
            <ChangeMeaningSheet
              visible
              item={item}
              onClose={jest.fn()}
              onChanged={onChanged}
              preferPersonalNote
            />
          </ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

    const personalInput = await screen.findByPlaceholderText(/Type a short gloss/);
    await fireEvent.changeText(personalInput, '청구하다');
    await waitFor(() => expect(personalInput.props.value).toBe('청구하다'));

    await fireEvent.press(screen.getByText('Save my meaning'));

    await waitFor(() => {
      expect(setLearningItemPersonalNote).toHaveBeenCalledWith('uws-1', '청구하다');
    });
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({ personal_note: '청구하다' }),
    );
  });

  it('sends personal_note when the sense changes after writing a personal gloss', async () => {
    (changeLearningItemSense as jest.Mock).mockResolvedValue({
      id: 'uws-1',
      word_sense_id: 'ws-2',
      learning_stage: 'learning',
      due_at: '2026-07-01T00:00:00Z',
      personal_note: '내 표현',
    });
    const onChanged = jest.fn();
    const onClose = jest.fn();
    await renderSheet({ onChanged, onClose, preferPersonalNote: true });

    await waitFor(() => expect(screen.getByText('충전하다')).toBeTruthy());
    await fireEvent.press(screen.getByText('충전하다'));
    const noteInput = screen.getByPlaceholderText(/Type a short gloss/);
    await fireEvent.changeText(noteInput, '내 표현');
    await waitFor(() => expect(noteInput.props.value).toBe('내 표현'));
    await fireEvent.press(screen.getByText('Save meaning'));

    await waitFor(() => {
      expect(changeLearningItemSense).toHaveBeenCalledWith('uws-1', 'ws-2', undefined, '내 표현');
    });
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          word_sense_id: 'ws-2',
          personal_note: '내 표현',
        }),
      );
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await flushAsync();
  });

  it('auto-expands personal meaning and shows structured retryable error when lookup fails', async () => {
    (lookupWord as jest.Mock).mockRejectedValueOnce(
      new ApiError(503, 'dictionary outage', 'ADD-403', true, 'provider_unavailable'),
    );
    await renderSheet();

    await waitFor(() => expect(screen.getByTestId('change-meaning-error-card')).toBeTruthy());
    expect(screen.getByText('Dictionary service unavailable')).toBeTruthy();
    expect(screen.getByText('Code: ADD-403')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Type a short gloss/)).toBeTruthy();

    (lookupWord as jest.Mock).mockResolvedValueOnce({ sense_options: [] });
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.queryByTestId('change-meaning-error-card')).toBeNull());
    await flushAsync();
  });

  it('supports custom cards without Find more or Clear and upgrades them cleanly', async () => {
    const customItem: LearningItemListItem = {
      ...item,
      id: 'uws-custom-1',
      word_sense_id: '',
      is_custom: true,
      word_id: '',
      lemma: 'glorp',
      normalized_text: 'glorp',
      part_of_speech: 'unknown',
      pronunciation: '/glorp/',
      cefr_level: 'A1',
      definition: 'old custom meaning',
      short_definition: 'old short',
      localized_definition: 'old custom meaning',
      localized_short_definition: 'old short',
      personal_note: 'old custom meaning',
    };

    (lookupWord as jest.Mock).mockResolvedValueOnce({ sense_options: [] });
    (setLearningItemPersonalNote as jest.Mock).mockResolvedValueOnce({
      id: 'uws-custom-1',
      word_sense_id: '',
      is_custom: true,
      learning_stage: 'new',
      due_at: '2026-07-01T00:00:00Z',
      personal_note: 'updated custom meaning',
    });

    const onChanged = jest.fn();
    await renderSheet({ item: customItem, onChanged });

    await waitFor(() => expect(lookupWord).toHaveBeenCalled());
    expect(screen.queryByText('Clear personal meaning')).toBeNull();
    expect(screen.queryByText('Find more senses')).toBeNull();

    const personalInput = screen.getByPlaceholderText(/Type a short gloss/);
    await fireEvent.changeText(personalInput, '   ');
    await waitFor(() => {
      expect(screen.getByText('Save my meaning')).toBeDisabled();
      expect(screen.getByText('Save meaning')).toBeDisabled();
    });

    await fireEvent.changeText(personalInput, 'updated custom meaning');
    await waitFor(() => {
      expect(screen.getByText('Save my meaning')).not.toBeDisabled();
      expect(screen.getByText('Save meaning')).not.toBeDisabled();
    });

    await fireEvent.press(screen.getByText('Save meaning'));
    await waitFor(() => {
      expect(setLearningItemPersonalNote).toHaveBeenCalledWith(
        'uws-custom-1',
        'updated custom meaning',
      );
    });
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        personal_note: 'updated custom meaning',
        definition: 'updated custom meaning',
        localized_definition: 'updated custom meaning',
      }),
    );
    await flushAsync();
  });

  it('upgrades a custom card to a dictionary sense cleanly and clears nullable metadata', async () => {
    const customItem: LearningItemListItem = {
      ...item,
      id: 'uws-custom-1',
      word_sense_id: '',
      is_custom: true,
      word_id: '',
      lemma: 'glorp',
      normalized_text: 'glorp',
      part_of_speech: 'unknown',
      pronunciation: '/glorp/',
      cefr_level: 'A1',
      definition: 'old custom meaning',
      short_definition: 'old short',
      localized_definition: 'old custom meaning',
      localized_short_definition: 'old short',
      personal_note: 'old custom meaning',
    };

    (lookupWord as jest.Mock).mockResolvedValueOnce({
      sense_options: [
        {
          word_id: 'w-glorp',
          word_sense_id: 'ws-glorp-1',
          language_code: 'en',
          lemma: 'glorp',
          normalized_text: 'glorp',
          part_of_speech: 'noun',
          pronunciation: null,
          display_language_code: 'ko',
          definition: 'to gleam softly',
          short_definition: null,
          localized_definition: '빛나다',
          localized_short_definition: null,
          cefr_level: null,
          meaning_order: 1,
          examples: [],
        },
      ],
    });
    (changeLearningItemSense as jest.Mock).mockResolvedValueOnce({
      id: 'uws-custom-1',
      word_sense_id: 'ws-glorp-1',
      is_custom: false,
      learning_stage: 'new',
      due_at: '2026-07-01T00:00:00Z',
    });

    const onChanged = jest.fn();
    await renderSheet({ item: customItem, onChanged });
    await waitFor(() => expect(screen.getByText('빛나다')).toBeTruthy());
    await fireEvent.press(screen.getByText('빛나다'));
    await fireEvent.press(screen.getByText('Save meaning'));

    await waitFor(() => {
      expect(changeLearningItemSense).toHaveBeenCalledWith(
        'uws-custom-1',
        'ws-glorp-1',
        undefined,
        undefined,
      );
    });
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        word_sense_id: 'ws-glorp-1',
        is_custom: false,
        word_id: 'w-glorp',
        part_of_speech: 'noun',
        pronunciation: null,
        short_definition: null,
        localized_short_definition: null,
        cefr_level: null,
        personal_note: null,
      }),
    );
    await flushAsync();
  });

  it('ignores stale lookupWord response when item changes before previous request settles', async () => {
    let resolveFirst!: (val: { sense_options: unknown[] }) => void;
    const firstPromise = new Promise<{ sense_options: unknown[] }>((resolve) => {
      resolveFirst = resolve;
    });
    (lookupWord as jest.Mock).mockReturnValueOnce(firstPromise);

    const utils = await renderSheet({ item });
    await waitFor(() => expect(lookupWord).toHaveBeenCalledTimes(1));

    const nextItem: LearningItemListItem = {
      ...item,
      id: 'uws-2',
      word_sense_id: 'ws-next',
      word_id: 'w-2',
      lemma: 'bright',
      normalized_text: 'bright',
      definition: 'shining',
      localized_definition: '밝은',
    };
    (lookupWord as jest.Mock).mockResolvedValueOnce({
      sense_options: [
        {
          word_id: 'w-2',
          word_sense_id: 'ws-next',
          language_code: 'en',
          lemma: 'bright',
          normalized_text: 'bright',
          part_of_speech: 'adjective',
          pronunciation: null,
          display_language_code: 'ko',
          definition: 'shining',
          short_definition: null,
          localized_definition: '밝은',
          localized_short_definition: null,
          cefr_level: null,
          meaning_order: 1,
          examples: [],
        },
      ],
    });

    await utils.rerender(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 375, height: 812 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>
            <ChangeMeaningSheet
              visible
              item={nextItem}
              onClose={jest.fn()}
              onChanged={jest.fn()}
            />
          </ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByText('밝은')).toBeTruthy());

    await act(async () => {
      resolveFirst({
        sense_options: [
          {
            word_id: 'w-1',
            word_sense_id: 'ws-stale',
            language_code: 'en',
            lemma: 'charge',
            normalized_text: 'charge',
            part_of_speech: 'verb',
            pronunciation: null,
            display_language_code: 'ko',
            definition: 'stale definition',
            short_definition: null,
            localized_definition: '오래된뜻',
            localized_short_definition: null,
            cefr_level: null,
            meaning_order: 1,
            examples: [],
          },
        ],
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('밝은')).toBeTruthy();
    expect(screen.queryByText('오래된뜻')).toBeNull();
    await flushAsync();
  });
});
