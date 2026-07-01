import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PracticeScreen } from './PracticeScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import * as learningItemsApi from '../../api/learningItems';
import type { DueItem } from '../../types';

jest.mock('../../api/learningItems', () => ({
  getDueLearningItems: jest.fn(),
  recordBatchReviewAttempts: jest.fn().mockResolvedValue({}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, []);
  },
}));

jest.mock('../../components/SpeakButton', () => ({
  SpeakButton: () => null,
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

const mockItem: DueItem = {
  user_word_sense_id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  language_code: 'en',
  lemma: 'discipline',
  normalized_text: 'discipline',
  part_of_speech: 'noun',
  pronunciation: null,
  display_language_code: 'ko',
  definition: 'Training that develops self-control.',
  short_definition: null,
  localized_definition: '자제력을 기르는 훈련.',
  localized_short_definition: null,
  cefr_level: null,
  meaning_order: 1,
  learning_stage: 'recognized',
  due_at: '2026-06-29T00:00:00Z',
  examples: [],
  preview_intervals: {
    again: '10m',
    hard: '1.2d',
    good: '2.5d',
    easy: '4.8d',
  },
};

describe('PracticeScreen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs step-by-step transitions: prompt -> reveal -> grading -> submit', async () => {
    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([mockItem]);

    const recordAttemptsMock = learningItemsApi.recordBatchReviewAttempts as jest.Mock;

    // Force decideCardMode to select 'flashcard' (flashcard uses randomized check on recognized items)
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.0);

    await render(<PracticeScreen />, { wrapper: Wrapper });

    // Step 1: Prompt State
    await waitFor(() => expect(screen.getByText('discipline')).toBeTruthy());
    
    // Stepper buttons should not be visible yet
    expect(screen.queryByTestId('btn-show-grading')).toBeNull();
    expect(screen.queryByText('How did this feel?')).toBeNull();

    // Flip Card (trigger flip to back)
    fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));

    // Step 2: Reveal State
    // "Rate Recall" (grading trigger button) is visible
    await waitFor(() => expect(screen.getByTestId('btn-show-grading')).toBeTruthy());
    // Rating options/bar are still hidden
    expect(screen.queryByText('How did this feel?')).toBeNull();

    // Click "Rate Recall" button to show rating options
    fireEvent.press(screen.getByTestId('btn-show-grading'));

    // Step 3: Grading State
    // Rating bar options should now be visible
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());
    expect(screen.getByText('Good')).toBeTruthy();

    // Click 'Good' to rate and submit
    fireEvent.press(screen.getByText('Good'));

    // The review attempt should be recorded
    await waitFor(() => {
      expect(recordAttemptsMock).toHaveBeenCalled();
    });

    randomSpy.mockRestore();
  });
});
