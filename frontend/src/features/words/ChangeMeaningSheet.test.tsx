import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
    expect(changeLearningItemSense).toHaveBeenCalledWith('uws-1', 'ws-2', undefined, '');
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
});
