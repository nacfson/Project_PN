import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import type { SenseOption } from '../types';
import { classifyAddError } from '../utils/addErrors';
import { SensePicker } from './SensePicker';

jest.mock('../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

const options: SenseOption[] = [
  {
    word_id: 'w1',
    word_sense_id: 'accuse',
    language_code: 'en',
    lemma: 'charge',
    normalized_text: 'charge',
    part_of_speech: 'verb',
    pronunciation: null,
    display_language_code: 'ko',
    definition: 'to accuse formally in a court',
    short_definition: null,
    localized_definition: '기소하다',
    localized_short_definition: '기소하다',
    cefr_level: 'B2',
    meaning_order: 1,
    similarity: 0.05,
    examples: [{ sentence: 'They charged him with fraud.', difficulty: null, localized_translation: null }],
  },
  {
    word_id: 'w1',
    word_sense_id: 'battery',
    language_code: 'en',
    lemma: 'charge',
    normalized_text: 'charge',
    part_of_speech: 'verb',
    pronunciation: null,
    display_language_code: 'ko',
    definition: 'to store electrical energy',
    short_definition: null,
    localized_definition: '충전하다',
    localized_short_definition: '충전하다',
    cefr_level: 'A2',
    meaning_order: 2,
    similarity: 0.4,
    examples: [{ sentence: 'Charge the battery overnight.', difficulty: null, localized_translation: null }],
  },
];

function wrap(ui: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      <AppLanguageProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

describe('SensePicker', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('renders simple gloss, POS · CEFR metadata, found count, and no example sentence or English definition', async () => {
    await render(
      wrap(
        <SensePicker
          visible
          query="charge"
          options={options}
          generating={false}
          onConfirm={jest.fn()}
          onForceExisting={jest.fn()}
          onForceWithPos={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );

    expect(screen.getByText('Which meaning did you mean?')).toBeTruthy();
    expect(screen.getByText('2 found')).toBeTruthy();
    expect(screen.getByText('기소하다')).toBeTruthy();
    expect(screen.getByText('충전하다')).toBeTruthy();
    expect(screen.getByText('verb · B2')).toBeTruthy();
    expect(screen.getByText('verb · A2')).toBeTruthy();

    // No English definition or example sentences rendered
    expect(screen.queryByText('to accuse formally in a court')).toBeNull();
    expect(screen.queryByText('to store electrical energy')).toBeNull();
    expect(screen.queryByText(/They charged him with fraud/)).toBeNull();
    expect(screen.queryByText(/Charge the battery overnight/)).toBeNull();
  });

  it('badges the closest context sense and adds via Add best match or Add to deck', async () => {
    const onConfirm = jest.fn();
    await render(
      wrap(
        <SensePicker
          visible
          query="charge"
          options={options}
          generating={false}
          sourceContext="Charge the battery overnight."
          onConfirm={onConfirm}
          onForceExisting={jest.fn()}
          onForceWithPos={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );
    expect(screen.getByText('Closest to your sentence')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add to deck'));
    expect(onConfirm).toHaveBeenCalledWith('battery');
  });

  it('asks for a sentence before force when context is empty', async () => {
    const onForceExisting = jest.fn();
    const onForceWithPos = jest.fn();
    await render(
      wrap(
        <SensePicker
          visible
          query="charge"
          options={options}
          generating={false}
          onConfirm={jest.fn()}
          onForceExisting={onForceExisting}
          onForceWithPos={onForceWithPos}
          onClose={jest.fn()}
        />,
      ),
    );
    await fireEvent.press(screen.getByText('None of these — search again'));
    await waitFor(() => {
      expect(screen.getByText(/Add a sentence that shows the meaning/)).toBeTruthy();
    });
    expect(onForceExisting).not.toHaveBeenCalled();
    expect(onForceWithPos).not.toHaveBeenCalled();
  });

  it('calls force with context when none-match and a sentence is present', async () => {
    const onForceExisting = jest.fn();
    await render(
      wrap(
        <SensePicker
          visible
          query="charge"
          options={options}
          generating={false}
          sourceContext="Charge the battery overnight."
          onConfirm={jest.fn()}
          onForceExisting={onForceExisting}
          onForceWithPos={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );
    await fireEvent.press(screen.getByText('충전하다'));
    await fireEvent.press(screen.getByText('None of these — search again'));
    await waitFor(() => {
      expect(onForceExisting).toHaveBeenCalledWith('w1', 'Charge the battery overnight.');
    });
  });

  it('shows explicit not-found recovery with Edit word and inline manual meaning save', async () => {
    const onAddManual = jest.fn();
    const onEditWord = jest.fn();
    const errorInfo = classifyAddError(new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'));
    await render(
      wrap(
        <SensePicker
          visible
          query="glorp"
          options={[]}
          lookingUp={false}
          errorInfo={errorInfo}
          onConfirm={jest.fn()}
          onAddManual={onAddManual}
          onEditWord={onEditWord}
          onForceExisting={jest.fn()}
          onForceWithPos={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );

    expect(screen.getByText('Not in dictionary')).toBeTruthy();
    expect(screen.getByText('Code: ADD-309')).toBeTruthy();
    expect(screen.queryByText('None of these — search again')).toBeNull();

    await fireEvent.press(screen.getByTestId('sense-edit-word-button'));
    expect(onEditWord).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('sense-save-manual'));
    expect(screen.getByText('Enter a meaning to save this word.')).toBeTruthy();
    expect(onAddManual).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('sense-manual-input'), '내 뜻');
    await fireEvent.press(screen.getByTestId('sense-save-manual'));
    expect(onAddManual).toHaveBeenCalledWith('내 뜻', 'unknown');
  });

  it('shows Try again on retryable provider errors', async () => {
    const onRetry = jest.fn();
    const errorInfo = classifyAddError(new ApiError(504, 'timed out', 'ADD-405', true, 'provider_timeout'));
    await render(
      wrap(
        <SensePicker
          visible
          query="charge"
          options={[]}
          lookingUp={false}
          errorInfo={errorInfo}
          onConfirm={jest.fn()}
          onAddManual={jest.fn()}
          onRetry={onRetry}
          onForceExisting={jest.fn()}
          onForceWithPos={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );

    expect(screen.getByText('Lookup timed out')).toBeTruthy();
    expect(screen.getByText('Code: ADD-405')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sense-retry-button'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('requires personal meaning when translationMissing is true and passes it to onConfirm', async () => {
    const onConfirm = jest.fn();
    const englishOnly: SenseOption[] = [
      {
        ...options[0],
        localized_definition: 'to accuse formally in a court',
        localized_short_definition: null,
        has_localized_translation: false,
      },
    ];
    await render(
      wrap(
        <SensePicker
          visible
          query="charge"
          options={englishOnly}
          translationMissing
          onConfirm={onConfirm}
          onForceExisting={jest.fn()}
          onForceWithPos={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );

    expect(screen.getByTestId('sense-translation-missing-banner')).toBeTruthy();
    expect(screen.getByText('to accuse formally in a court')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('sense-add'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a meaning to save this word.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('sense-translation-note-input'), '기소하다');
    await fireEvent.press(screen.getByTestId('sense-add'));
    expect(onConfirm).toHaveBeenCalledWith('accuse', '기소하다');
  });
});
