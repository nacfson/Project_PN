import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './HomeScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('../../api/auth', () => ({
  me: jest.fn().mockResolvedValue({ email: 'Learner@example.com' })
}));
jest.mock('../../api/stats', () => ({
  getStatsSummary: jest.fn().mockResolvedValue({
    due_today: 5,
    review_streak_days: 3,
    daily_goal_xp: 200,
    reviews_today: 10,
    streak_at_risk: false,
    vacation_mode_active: false,
    streak_freeze_tokens: 1,
    longest_streak_days: 10,
    stage_counts: { new: 2, learning: 3, recognized: 5, recalled: 4, usable: 2, mastered: 1 },
    forecast: [
      { date: '2026-07-04', count: 5 },
      { date: '2026-07-05', count: 3 }
    ]
  })
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

describe('HomeScreen', () => {
  it('renders without crashing', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });
    // The greeting text is rendered with the default display name "Learner"
    expect(screen.getByText('Hello, Learner')).toBeTruthy();
  });

  it('renders Bento grid widget elements', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });
    expect(screen.getByTestId('bento-grid-container')).toBeTruthy();
    expect(screen.getByTestId('hero-bento-card')).toBeTruthy();
    expect(screen.getByTestId('xp-progress-orb')).toBeTruthy();
    expect(screen.getByTestId('forecast-spline-chart')).toBeTruthy();
  });

  it('renders interactive forecast tooltip on node selection', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });
    expect(screen.queryByTestId('forecast-tooltip')).toBeNull();
    const firstNode = screen.getByTestId('forecast-node-0');
    fireEvent.press(firstNode);
    await waitFor(() => {
      expect(screen.getByTestId('forecast-tooltip')).toBeTruthy();
    });
  });

  it('renders interactive XP progress details bubble on orb press', async () => {
    await render(<HomeScreen />, { wrapper: Wrapper });
    expect(screen.queryByTestId('xp-details-bubble')).toBeNull();
    const orb = screen.getByTestId('xp-progress-orb');
    fireEvent.press(orb);
    await waitFor(() => {
      expect(screen.getByTestId('xp-details-bubble')).toBeTruthy();
    });
  });
});
