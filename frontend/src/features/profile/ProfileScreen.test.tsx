import React, { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ApiError } from '../../api/client';
import { getReviewSettings, patchReviewSettings } from '../../api/reviewSettings';
import { getStreakSettings, patchStreakSettings } from '../../api/streakSettings';
import { AppLanguageProvider } from '../../i18n';
import { colors } from '../../theme/tokens';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ProfileScreen } from './ProfileScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockLogout = jest.fn();
const mockMe = jest.fn();
jest.mock('../../api/auth', () => ({
  __esModule: true,
  logout: (...args: any[]) => mockLogout(...args),
  me: (...args: any[]) => mockMe(...args),
}));

jest.mock('../../api/reviewSettings', () => ({
  __esModule: true,
  getReviewSettings: jest.fn(),
  patchReviewSettings: jest.fn(),
}));

jest.mock('../../api/streakSettings', () => ({
  __esModule: true,
  getStreakSettings: jest.fn(),
  patchStreakSettings: jest.fn(),
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  clearLegacyThemePreferences: jest.fn().mockResolvedValue(undefined),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMe.mockResolvedValue({
      id: 'user-1',
      email: 'learner@example.com',
      email_verified: true,
      native_language: 'ko',
      target_language: 'en',
      ui_language: 'en',
    });
    (getReviewSettings as jest.Mock).mockResolvedValue({
      daily_goal_xp: 200,
      desired_retention: 0.9,
    });
    (getStreakSettings as jest.Mock).mockResolvedValue({
      vacation_mode_active: false,
      vacation_mode_until: null,
      streak_freeze_tokens: 1,
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renders groups in the order Account, Review, Streak, Appearance, then Help/About/Log out', async () => {
    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Account')).toBeTruthy());

    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Streak')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Help & Feedback')).toBeTruthy();
    expect(screen.getByText('About Project PN')).toBeTruthy();
    expect(screen.getByText('Log out')).toBeTruthy();

    const serialized = JSON.stringify(screen.toJSON());
    const idxAccount = serialized.indexOf('"Account"');
    const idxReview = serialized.indexOf('"Review"');
    const idxStreak = serialized.indexOf('"Streak"');
    const idxAppearance = serialized.indexOf('"Appearance"');
    const idxLogout = serialized.indexOf('"Log out"');

    expect(idxAccount).toBeGreaterThan(-1);
    expect(idxAccount).toBeLessThan(idxReview);
    expect(idxReview).toBeLessThan(idxStreak);
    expect(idxStreak).toBeLessThan(idxAppearance);
    expect(idxAppearance).toBeLessThan(idxLogout);
  });

  it('calls patchReviewSettings({ daily_goal_xp: 300 }) when 300 is selected', async () => {
    (patchReviewSettings as jest.Mock).mockResolvedValue({
      daily_goal_xp: 300,
      desired_retention: 0.9,
    });

    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('daily-goal-option-300')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('daily-goal-option-300'));
    await waitFor(() => {
      expect(patchReviewSettings).toHaveBeenCalledWith({ daily_goal_xp: 300 });
    });
  });

  it('shows a selected "250" option when saved goal is 250', async () => {
    (getReviewSettings as jest.Mock).mockResolvedValue({
      daily_goal_xp: 250,
      desired_retention: 0.9,
    });

    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('daily-goal-option-250')).toBeTruthy());

    expect(screen.getByTestId('daily-goal-option-250').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('reverts selection and shows settings.dailyGoalSaveFailed inline when save fails', async () => {
    (patchReviewSettings as jest.Mock).mockRejectedValue(new Error('save_failed'));

    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('daily-goal-option-200')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('daily-goal-option-300'));
    await waitFor(() => {
      expect(screen.getAllByText('Could not save daily goal').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByTestId('daily-goal-option-200').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('shows a retention percentage and saves when adjusted', async () => {
    (patchReviewSettings as jest.Mock).mockResolvedValue({
      daily_goal_xp: 200,
      desired_retention: 0.85,
    });

    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('retention-value')).toBeTruthy());
    expect(screen.getByTestId('retention-value').props.children).toBe('90%');

    await fireEvent(screen.getByTestId('retention-slider'), 'valueChange', 85);
    await waitFor(() => {
      expect(patchReviewSettings).toHaveBeenCalledWith({ desired_retention: 0.85 });
      expect(screen.getByTestId('retention-value').props.children).toBe('85%');
    });
  });

  it('toggles the vacation switch', async () => {
    (patchStreakSettings as jest.Mock).mockResolvedValue({
      vacation_mode_active: true,
      vacation_mode_until: '2026-07-07',
      streak_freeze_tokens: 1,
    });

    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('vacation-switch')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('vacation-switch'));
    await waitFor(() => {
      expect(patchStreakSettings).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('vacation-switch').props.accessibilityState).toEqual(
        expect.objectContaining({ checked: true }),
      );
    });
  });

  it('renders only app language inside Appearance (no Theme row) and styles Log out with danger tone', async () => {
    await render(<ProfileScreen onLogout={jest.fn()} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Log out')).toBeTruthy());

    expect(screen.getByText('App language')).toBeTruthy();
    expect(screen.queryByText(/dark theme/i)).toBeNull();
    expect(screen.queryByText(/theme/i)).toBeNull();

    const logoutText = screen.getByText('Log out');
    expect(StyleSheet.flatten(logoutText.props.style)).toEqual(
      expect.objectContaining({ color: colors.danger }),
    );
  });

  it('calls onLogout when logout succeeds', async () => {
    mockLogout.mockResolvedValue(undefined);
    const onLogout = jest.fn();

    await render(<ProfileScreen onLogout={onLogout} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Log out')).toBeTruthy());

    await fireEvent.press(screen.getByText('Log out'));
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  });

  it('shows inline error and keeps user on screen when logout fails with 503', async () => {
    mockLogout.mockRejectedValue(new ApiError(503, 'service_unavailable'));
    const onLogout = jest.fn();

    await render(<ProfileScreen onLogout={onLogout} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Log out')).toBeTruthy());

    await fireEvent.press(screen.getByText('Log out'));
    await waitFor(() =>
      expect(screen.getByText('Could not log out. Please try again.')).toBeTruthy(),
    );
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('transitions via onLogout when logout rejects with 401 (already expired session)', async () => {
    mockLogout.mockRejectedValue(new ApiError(401, 'unauthorized'));
    const onLogout = jest.fn();

    await render(<ProfileScreen onLogout={onLogout} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Log out')).toBeTruthy());

    await fireEvent.press(screen.getByText('Log out'));
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  });
});
