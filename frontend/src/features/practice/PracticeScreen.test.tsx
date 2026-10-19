import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PracticeScreen } from './PracticeScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import * as learningItemsApi from '../../api/learningItems';
import { ApiError } from '../../api/client';
import type { DueItem } from '../../types';

jest.mock('../../api/learningItems', () => ({
  getDueLearningItems: jest.fn(),
  listLearningItems: jest.fn().mockResolvedValue({ items: [], next_cursor: null }),
  recordBatchReviewAttempts: jest.fn().mockResolvedValue({ xp_earned: 10, success: true }),
}));

jest.mock('../../api/reviewSettings', () => ({
  getReviewSettings: jest.fn().mockResolvedValue({
    user_id: 'u1',
    new_cards_per_day: 20,
    reviews_per_day: 200,
    learning_steps: [1, 10],
    relearning_steps: [10],
    leech_threshold: 8,
    leech_action: 'tag',
    fuzz_enabled: true,
    desired_retention: 0.9,
    daily_goal_xp: 100,
    fsrs_weights: [],
    weights_optimized_at: null,
    weights_review_count: 0,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: undefined }),
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

    await render(<PracticeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(getDueMock).toHaveBeenCalledWith(undefined, undefined, 'private');
    });

    // Step 1: Prompt State
    await waitFor(() => expect(screen.getByText('discipline')).toBeTruthy());
    
    // Stepper buttons should not be visible yet
    expect(screen.queryByText('How did this feel?')).toBeNull();

    // Flip Card (trigger flip to back)
    await fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));

    // Step 2: Grading State (rating bar options should now be visible immediately)
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());
    expect(screen.getByText('Good')).toBeTruthy();

    // Click 'Good' to rate and submit
    await fireEvent.press(screen.getByText('Good'));

    // The review attempt should be recorded
    await waitFor(() => {
      expect(recordAttemptsMock).toHaveBeenCalled();
    });
  });

  it('shows Retrying for recovered learning-stage cards after a refresh', async () => {
    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([{ ...mockItem, learning_stage: 'learning' }]);

    await render(<PracticeScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getAllByText('Retrying').length).toBeGreaterThan(0));
  });

  it('shows learning-step previews immediately after Again on a retry card', async () => {
    const itemA: DueItem = {
      ...mockItem,
      user_word_sense_id: 'uws-a',
      lemma: 'alpha',
      normalized_text: 'alpha',
    };
    const itemB: DueItem = {
      ...mockItem,
      user_word_sense_id: 'uws-b',
      lemma: 'beta',
      normalized_text: 'beta',
    };

    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([itemA, itemB]);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999);

    await render(<PracticeScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());
    await fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());
    await fireEvent.press(screen.getByText('Forgot'));

    await waitFor(() => expect(screen.getByText('beta')).toBeTruthy());
    await fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());
    await fireEvent.press(screen.getByText('Good'));

    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());
    await fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());

    expect(screen.getAllByText('1m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10m').length).toBeGreaterThan(0);
    expect(screen.queryByText('2.5d')).toBeNull();

    randomSpy.mockRestore();
  });

  it('does not open the first due card in origin/add order', async () => {
    const itemA: DueItem = {
      ...mockItem,
      user_word_sense_id: 'uws-a',
      lemma: 'alpha',
      normalized_text: 'alpha',
    };
    const itemB: DueItem = {
      ...mockItem,
      user_word_sense_id: 'uws-b',
      lemma: 'beta',
      normalized_text: 'beta',
    };

    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([itemA, itemB]);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await render(<PracticeScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('beta')).toBeTruthy());
    expect(screen.queryByText('alpha')).toBeNull();
    randomSpy.mockRestore();
  });

  it('exits syncing when batch returns a non-retryable unavailable error', async () => {
    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([mockItem]);

    const recordAttemptsMock = learningItemsApi.recordBatchReviewAttempts as jest.Mock;
    recordAttemptsMock.mockRejectedValue(
      new ApiError(409, 'review item is archived or suspended', 'REV-409', false),
    );

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.0);
    await render(<PracticeScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('discipline')).toBeTruthy());
    await fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());
    await fireEvent.press(screen.getByText('Good'));

    await waitFor(() => {
      expect(screen.getByText('Practice Complete')).toBeTruthy();
    });
    expect(recordAttemptsMock.mock.calls.length).toBeLessThan(3);

    randomSpy.mockRestore();
  });

  it('keeps leech cards in quiz with Fail repeatedly and shows Stuck words at session end', async () => {
    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([{ ...mockItem, is_leech: true, lapse_count: 8 }]);

    const recordAttemptsMock = learningItemsApi.recordBatchReviewAttempts as jest.Mock;
    recordAttemptsMock.mockResolvedValue({
      xp_earned: 10,
      success: true,
      updated_items: [
        {
          user_word_sense_id: 'uws-1',
          learning_stage: 'recognized',
          due_at: '2026-06-30T00:00:00Z',
          leech: true,
          is_leech: true,
          lapse_count: 8,
        },
      ],
    });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.0);
    await render(<PracticeScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('discipline')).toBeTruthy());
    expect(screen.getAllByText('Fail repeatedly!').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByText('TAP TO REVEAL ANSWER'));
    await waitFor(() => expect(screen.getByText('How did this feel?')).toBeTruthy());
    expect(screen.getByText('Change meaning')).toBeTruthy();

    await fireEvent.press(screen.getByText('Good'));

    await waitFor(() => {
      expect(screen.getByText('Stuck words')).toBeTruthy();
    });
    expect(screen.getByText('Write my meaning')).toBeTruthy();
    expect(screen.getByText('Practice Complete')).toBeTruthy();

    randomSpy.mockRestore();
  });
});
