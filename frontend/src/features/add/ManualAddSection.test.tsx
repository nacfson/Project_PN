import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ManualAddSection } from './ManualAddSection';
import { addLearningItem, lookupWord } from '../../api/words';

jest.mock('../../api/words', () => ({
  addLearningItem: jest.fn().mockResolvedValue({ id: 'item-1', word_sense_id: 'sense-1' }),
  lookupWord: jest.fn().mockResolvedValue({
    sense_options: [
      {
        word_id: 'w1',
        word_sense_id: 'sense-1',
        language_code: 'en',
        lemma: 'charge',
        normalized_text: 'charge',
        part_of_speech: 'verb',
        pronunciation: null,
        display_language_code: 'ko',
        definition: 'to store energy',
        short_definition: 'store energy',
        localized_definition: '충전하다',
        localized_short_definition: '충전하다',
        cefr_level: 'A2',
        meaning_order: 1,
        examples: [{ sentence: 'Charge it overnight.', difficulty: null, localized_translation: null }],
      },
    ],
  }),
}));

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
}));

jest.mock('../../components/SensePicker', () => {
  const ReactLocal = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    SensePicker: ({
      visible,
      options,
      onConfirm,
    }: {
      visible: boolean;
      options: Array<{ word_sense_id: string; definition: string }>;
      onConfirm: (id: string) => void;
    }) => {
      if (!visible) return null;
      return ReactLocal.createElement(
        View,
        { testID: 'sense-picker-mock' },
        options.map((o: { word_sense_id: string; definition: string }) =>
          ReactLocal.createElement(
            Pressable,
            { key: o.word_sense_id, onPress: () => onConfirm(o.word_sense_id) },
            ReactLocal.createElement(Text, null, o.definition),
          ),
        ),
      );
    },
  };
});

async function renderSection() {
  return render(
    <AppLanguageProvider>
      <ThemeProvider>
        <ManualAddSection selectedDeckId="deck-123" targetLanguage="en" />
      </ThemeProvider>
    </AppLanguageProvider>,
  );
}

describe('ManualAddSection', () => {
  beforeEach(() => {
    (lookupWord as jest.Mock).mockClear();
    (addLearningItem as jest.Mock).mockClear();
  });

  it('disables find when input is empty', async () => {
    await renderSection();
    expect(screen.getByText('Find my sense')).toBeDisabled();
  });

  it('wraps the word input for layout', async () => {
    await renderSection();
    expect(screen.getByTestId('manual-add-input-wrapper')).toBeTruthy();
  });

  it('looks up with sourceContext and confirms selected sense', async () => {
    await renderSection();

    const wordInput = screen.getByPlaceholderText('Type a word or phrase (e.g. look up)');
    fireEvent.changeText(wordInput, 'charge');
    await waitFor(() => expect(wordInput.props.value).toBe('charge'));

    const contextInput = screen.getByPlaceholderText(/Optional sentence/);
    fireEvent.changeText(contextInput, 'Charge the battery overnight.');
    await waitFor(() => expect(contextInput.props.value).toBe('Charge the battery overnight.'));

    fireEvent.press(screen.getByText('Find my sense'));

    await waitFor(() => {
      expect(lookupWord).toHaveBeenCalledWith(
        'charge',
        expect.objectContaining({
          sourceContext: 'Charge the battery overnight.',
          languageCode: 'en',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('to store energy')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('to store energy'));

    await waitFor(() => {
      expect(addLearningItem).toHaveBeenCalledWith(
        'sense-1',
        expect.any(String),
        'deck-123',
        'Charge the battery overnight.',
      );
    });
  });

  it('auto-selects phrase POS and looks up multi-word input as a phrase', async () => {
    (lookupWord as jest.Mock).mockResolvedValueOnce({
      sense_options: [
        {
          word_id: 'w2',
          word_sense_id: 'sense-phrase',
          language_code: 'en',
          lemma: 'look up',
          normalized_text: 'look up',
          part_of_speech: 'phrase',
          pronunciation: null,
          display_language_code: 'ko',
          definition: 'to search for information',
          short_definition: 'search for',
          localized_definition: '~을 찾아보다',
          localized_short_definition: '~을 찾아보다',
          cefr_level: 'A2',
          meaning_order: 1,
          examples: [],
        },
      ],
    });

    await renderSection();

    const wordInput = screen.getByPlaceholderText('Type a word or phrase (e.g. look up)');
    fireEvent.changeText(wordInput, 'look up');
    await waitFor(() => expect(wordInput.props.value).toBe('look up'));
    await waitFor(() => expect(screen.getByText('phrase')).toBeTruthy());

    fireEvent.press(screen.getByText('Find my sense'));

    await waitFor(() => {
      expect(lookupWord).toHaveBeenCalledWith(
        'look up',
        expect.objectContaining({
          partOfSpeech: 'phrase',
          languageCode: 'en',
        }),
      );
    });
  });

  it('validates fields on blur', async () => {
    await renderSection();

    const input = screen.getByPlaceholderText('Type a word or phrase (e.g. look up)');
    fireEvent.changeText(input, 'hello123');
    await waitFor(() => {
      expect(input.props.value).toBe('hello123');
    });
    fireEvent(input, 'blur');
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid word or phrase.')).toBeTruthy();
    });
  });
});
