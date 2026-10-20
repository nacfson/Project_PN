import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ApiError } from '../../api/client';

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
  getReviewSettings: jest.fn().mockResolvedValue({
    daily_goal_xp: 50,
    desired_retention: 0.9,
  }),
  patchReviewSettings: jest.fn(),
}));

jest.mock('../../api/streakSettings', () => ({
  __esModule: true,
  getStreakSettings: jest.fn().mockResolvedValue({
    vacation_mode_active: false,
    vacation_mode_until: null,
    streak_freeze_tokens: 1,
  }),
  patchStreakSettings: jest.fn(),
}));

jest.mock('../../api/storage', () => ({
  appLanguageStorage: {
    getLanguage: jest.fn().mockResolvedValue('en'),
    setLanguage: jest.fn().mockResolvedValue(undefined),
  },
  themeModeStorage: {
    getMode: jest.fn().mockResolvedValue('light'),
    setMode: jest.fn().mockResolvedValue(undefined),
  },
  themeVariationStorage: {
    getVariation: jest.fn().mockResolvedValue('default'),
    setVariation: jest.fn().mockResolvedValue(undefined),
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('ProfileScreen logout handling', () => {
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
      expect(screen.getByText('Could not log out. Please try again.')).toBeTruthy()
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
