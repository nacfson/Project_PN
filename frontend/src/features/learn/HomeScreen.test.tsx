import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './HomeScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { getStatsSummary } from '../../api/stats';
import { getDueLearningItems } from '../../api/learningItems';

jest.mock('../../theme/motion', () => ({
  ...jest.requireActual('../../theme/motion'),
  useReducedMotion: () => true,
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/stats', () => ({
  getStatsSummary: jest.fn(),
}));

jest.mock('../../api/learningItems', () => ({
  getDueLearningItems: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(() => {
      cb();
    }, [cb]);
  },
}));

const mockedGetStatsSummary = jest.mocked(getStatsSummary);
const mockedGetDueLearningItems = jest.mocked(getDueLearningItems);

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 1200, height: 800 },
      }}
    >
      <AppLanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

const DEFAULT_STATS = {
  due_today: 16,
  review_streak_days: 0,
  daily_goal_xp: 200,
  reviews_today: 0,
  streak_at_risk: false,
  vacation_mode_active: false,
  streak_freeze_tokens: 1,
  longest_streak_days: 0,
  stage_counts: {
    new: 16,
    learning: 0,
    recognized: 0,
    recalled: 0,
    usable: 0,
    mastered: 0,
  },
  forecast: [{ date: '2099-01-01', count: 0 }],
};

const DEFAULT_UP_NEXT = [
  {
    user_word_sense_id: 'uws-1',
    word_id: 'w-1',
    lemma: 'resilient',
    normalized_text: 'resilient',
    pronunciation: '/rɪˈzɪliənt/',
    part_of_speech: 'adjective',
    definition: 'able to recover',
    learning_stage: 'new',
    due_at: '2026-11-05T00:00:00Z',
  },
  {
    user_word_sense_id: 'uws-2',
    word_id: 'w-2',
    lemma: 'ubiquitous',
    normalized_text: 'ubiquitous',
    pronunciation: '/juːˈbɪkwɪtəs/',
    part_of_speech: 'adjective',
    definition: 'everywhere',
    learning_stage: 'new',
    due_at: '2026-11-05T00:00:00Z',
  },
  {
    user_word_sense_id: 'uws-3',
    word_id: 'w-3',
    lemma: 'mitigate',
    normalized_text: 'mitigate',
    pronunciation: '/ˈmɪtɪɡeɪt/',
    part_of_speech: 'verb',
    definition: 'make less severe',
    learning_stage: 'new',
    due_at: '2026-11-05T00:00:00Z',
  },
  {
    user_word_sense_id: 'uws-4',
    word_id: 'w-4',
    lemma: 'latency',
    normalized_text: 'latency',
    pronunciation: '/ˈleɪtənsi/',
    part_of_speech: 'noun',
    definition: 'delay',
    learning_stage: 'new',
    due_at: '2026-11-05T00:00:00Z',
  },
  {
    user_word_sense_id: 'uws-5',
    word_id: 'w-5',
    lemma: 'pragmatic',
    normalized_text: 'pragmatic',
    pronunciation: '/præɡˈmætɪk/',
    part_of_speech: 'adjective',
    definition: 'practical',
    learning_stage: 'new',
    due_at: '2026-11-05T00:00:00Z',
  },
];

describe('HomeScreen (Today)', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  let keyListeners: Array<(e: KeyboardEvent) => void> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    keyListeners = [];
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
    const win = ((globalThis as unknown as { window?: Record<string, unknown> }).window ??
      ((globalThis as unknown as { window: Record<string, unknown> }).window = {}));
    win.IS_REACT_ACT_ENVIRONMENT = true;
    win.addEventListener = jest.fn((event: string, cb: (e: KeyboardEvent) => void) => {
      if (event === 'keydown') keyListeners.push(cb);
    });
    win.removeEventListener = jest.fn((event: string, cb: (e: KeyboardEvent) => void) => {
      if (event === 'keydown') keyListeners = keyListeners.filter((l) => l !== cb);
    });
    mockedGetStatsSummary.mockResolvedValue(DEFAULT_STATS as any);
    mockedGetDueLearningItems.mockResolvedValue(DEFAULT_UP_NEXT as any);
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Platform, 'OS', originalDescriptor);
    }
  });

  it('shows headline "16 words are due", estimate, Start review and Add a word in due state', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('16 words are due')).toBeTruthy();
    });
    expect(screen.getByText(/About 8 minutes/)).toBeTruthy();
    expect(screen.getByText('Start review')).toBeTruthy();
    expect(screen.getByText('Add a word')).toBeTruthy();
  });

  it('renders glance strip with daily goal, streak with freezes, and total words with next review', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Daily goal')).toBeTruthy();
    });
    expect(screen.getByText('/ 200 XP')).toBeTruthy();
    expect(screen.getByText('Streak')).toBeTruthy();
    expect(screen.getByText('1 freeze available')).toBeTruthy();
    expect(screen.getByText('In your decks')).toBeTruthy();
    expect(screen.getByText(/Next review after today: none yet/)).toBeTruthy();
  });

  it('renders Up next with 5 items plus "and 11 more" and mastery legend with 6 stages', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('resilient')).toBeTruthy();
    });
    expect(screen.getByText('ubiquitous')).toBeTruthy();
    expect(screen.getByText('mitigate')).toBeTruthy();
    expect(screen.getByText('latency')).toBeTruthy();
    expect(screen.getByText('pragmatic')).toBeTruthy();
    expect(screen.getByText('and 11 more')).toBeTruthy();

    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Learning')).toBeTruthy();
    expect(screen.getByText('Recognized')).toBeTruthy();
    expect(screen.getByText('Recalled')).toBeTruthy();
    expect(screen.getByText('Usable')).toBeTruthy();
    expect(screen.getByText('Mastered')).toBeTruthy();
  });

  it('shows nothing-due state when due_today is 0 and totalWords > 0', async () => {
    mockedGetStatsSummary.mockResolvedValue({
      ...DEFAULT_STATS,
      due_today: 0,
    } as any);
    mockedGetDueLearningItems.mockResolvedValue([]);

    await render(<HomeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("You're caught up for today")).toBeTruthy();
    });
    expect(screen.getByText('Add a word')).toBeTruthy();
    expect(screen.queryByText('Start review')).toBeNull();
  });

  it('shows empty mastery track when totalWords is 0', async () => {
    mockedGetStatsSummary.mockResolvedValue({
      ...DEFAULT_STATS,
      due_today: 0,
      stage_counts: {
        new: 0,
        learning: 0,
        recognized: 0,
        recalled: 0,
        usable: 0,
        mastered: 0,
      },
    } as any);
    mockedGetDueLearningItems.mockResolvedValue([]);

    await render(<HomeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('No words yet')).toBeTruthy();
    });
  });

  it('navigates to Practice on Enter when due > 0 and ignores Enter when due === 0', async () => {
    const { unmount } = await render(<HomeScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('16 words are due')).toBeTruthy();
    });

    for (const listener of [...keyListeners]) {
      listener({
        key: 'Enter',
        target: { tagName: 'DIV' },
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent);
    }

    expect(mockNavigate).toHaveBeenCalledWith('Practice', { origin: 'private' });
    await unmount();

    mockNavigate.mockClear();
    mockedGetStatsSummary.mockResolvedValue({
      ...DEFAULT_STATS,
      due_today: 0,
    } as any);
    mockedGetDueLearningItems.mockResolvedValue([]);

    await render(<HomeScreen />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText("You're caught up for today")).toBeTruthy();
    });

    for (const listener of [...keyListeners]) {
      listener({
        key: 'Enter',
        target: { tagName: 'DIV' },
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent);
    }

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
