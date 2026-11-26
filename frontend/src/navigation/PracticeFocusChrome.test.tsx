import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MainTabs } from './MainTabs';
import { navigationRef } from './navigationRef';
import * as learningItemsApi from '../api/learningItems';
import type { DueItem } from '../types';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 1200, height: 800 };
  const SafeAreaInsetsContext = React.createContext(insets);
  const SafeAreaFrameContext = React.createContext(frame);
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => (
      <SafeAreaFrameContext.Provider value={frame}>
        <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
      </SafeAreaFrameContext.Provider>
    ),
    SafeAreaView: ({ children, style, ...props }: any) =>
      React.createElement('View', { ...props, style }, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics: { insets, frame },
  };
});

jest.mock('@react-navigation/elements', () => {
  const React = require('react');
  const { View } = require('react-native');
  const actual = jest.requireActual('@react-navigation/elements');
  const frame = { width: 1200, height: 800 };
  const frameContextValue = {
    getCurrent: () => frame,
    subscribe: () => () => {},
    subscribeThrottled: () => () => {},
  };
  const SafeAreaProviderCompat = ({ children, style }: any) => {
    const FrameContext = (globalThis as any).__react_navigation__elements_contexts?.get('FrameContext');
    const content = <View style={[{ flex: 1 }, style]}>{children}</View>;
    return FrameContext ? (
      <FrameContext.Provider value={frameContextValue}>{content}</FrameContext.Provider>
    ) : (
      content
    );
  };
  SafeAreaProviderCompat.initialMetrics = {
    frame: { x: 0, y: 0, width: 1200, height: 800 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  };
  return {
    ...actual,
    SafeAreaProviderCompat,
  };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1200, height: 800, scale: 1, fontScale: 1 }),
}));

jest.mock('../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../hooks/useActiveTargetLanguage', () => ({
  useActiveTargetLanguage: () => ({
    targetLanguage: 'en',
    displayLanguage: 'English',
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('../hooks/useAddQueue', () => ({
  useAddQueue: () => ({
    jobs: [],
    pendingCount: 0,
    dismissedIds: new Set(),
    dismiss: jest.fn(),
    failedItems: [],
    retryFailed: jest.fn(),
    dismissFailed: jest.fn(),
  }),
}));

jest.mock('../api/learningItems', () => ({
  getDueLearningItems: jest.fn(),
  listLearningItems: jest.fn().mockResolvedValue({ items: [], next_cursor: null }),
  recordBatchReviewAttempts: jest.fn().mockResolvedValue({ xp_earned: 10, success: true }),
}));

jest.mock('../api/reviewSettings', () => ({
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

jest.mock('../components/SpeakButton', () => ({
  SpeakButton: () => null,
}));

jest.mock('../features/learn/HomeScreen', () => ({
  HomeScreen: () => {
    const { View } = require('react-native');
    return <View testID="mock-home-screen" />;
  },
}));
jest.mock('./WordsStack', () => ({
  WordsStack: () => {
    const { View } = require('react-native');
    return <View testID="mock-words-stack" />;
  },
}));
jest.mock('./AddScreen', () => ({
  AddScreen: () => {
    const { View } = require('react-native');
    return <View testID="mock-add-screen" />;
  },
}));
jest.mock('./SettingsStack', () => ({
  SettingsStack: () => {
    const { View } = require('react-native');
    return <View testID="mock-settings-stack" />;
  },
}));

const mockDueItem: DueItem = {
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

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 1200, height: 800 },
      }}
    >
      <ThemeProvider>
        <AppLanguageProvider>
          <NavigationContainer ref={navigationRef}>{children}</NavigationContainer>
        </AppLanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('MainTabs Practice focus chrome regression', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Platform, 'OS', originalDescriptor);
    }
  });

  it('keeps Sidebar and CommandDock visible when switching from Practice to Words before due items settle', async () => {
    let resolveDue!: (items: DueItem[]) => void;
    const deferredDue = new Promise<DueItem[]>((resolve) => {
      resolveDue = resolve;
    });
    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockReturnValue(deferredDue);

    const { unmount } = await render(<MainTabs onLogout={jest.fn()} />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('shell-sidebar')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('tab-button-practice'));
    await waitFor(() => expect(getDueMock).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId('tab-button-words'));
    await waitFor(() => expect(screen.getByTestId('mock-words-stack')).toBeTruthy());

    await act(async () => {
      resolveDue([mockDueItem]);
    });

    expect(screen.getByTestId('shell-sidebar')).toBeTruthy();
    expect(screen.getByTestId('command-dock')).toBeTruthy();

    await unmount();
  });

  it('hides Sidebar during active Practice and restores it on leaving via navigation or End Session', async () => {
    const getDueMock = learningItemsApi.getDueLearningItems as jest.Mock;
    getDueMock.mockResolvedValue([mockDueItem]);

    const { unmount } = await render(<MainTabs onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('shell-sidebar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-button-practice'));
    await waitFor(() => expect(screen.getByText('discipline')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('shell-sidebar')).toBeNull());
    expect(screen.queryByTestId('command-dock')).toBeNull();

    await act(async () => {
      navigationRef.navigate('Add', { mode: 'manual' });
    });

    await waitFor(() => expect(screen.getByTestId('shell-sidebar')).toBeTruthy());
    expect(screen.getByTestId('command-dock')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-button-practice'));
    await waitFor(() => expect(screen.queryByTestId('shell-sidebar')).toBeNull());

    await fireEvent.press(screen.getByTestId('practice-end-session'));
    await waitFor(() => expect(screen.getByTestId('shell-sidebar')).toBeTruthy());
    expect(screen.getByTestId('command-dock')).toBeTruthy();

    await unmount();
  });
});
