import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { EditLanguagePairScreen } from './EditLanguagePairScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { ApiError } from '../../api/client';
import { clearLanguageOptionsCache } from '../../api/auth';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { targetLanguage: 'en', displayLanguage: 'ko' } }),
}));

jest.mock('../../api/auth', () => ({
  ...jest.requireActual('../../api/auth'),
  getLanguageOptions: jest.fn().mockResolvedValue({
    defaults: {},
    allowed: { target_languages: [], definition_languages: [] },
    forced: {},
  }),
}));

const mockGetUserLanguages = jest.fn().mockResolvedValue([]);
const mockUpdateLanguagePair = jest.fn();
jest.mock('../../api/userLanguages', () => ({
  __esModule: true,
  getUserLanguages: () => mockGetUserLanguages(),
  updateLanguagePair: (...args: any[]) => mockUpdateLanguagePair(...args),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <LanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </LanguageProvider>
    </AppLanguageProvider>
  );
}

describe('EditLanguagePairScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLanguageOptionsCache();
    mockUpdateLanguagePair.mockResolvedValue(undefined);
    mockGetUserLanguages.mockResolvedValue([]);
  });

  it('calls updateLanguagePair with new target and display language on save', async () => {
    await render(<EditLanguagePairScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('target-language-ja')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('target-language-ja'));

    await waitFor(() =>
      expect(screen.getByText('Save').props.accessibilityState?.disabled).not.toBe(true)
    );

    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockUpdateLanguagePair).toHaveBeenCalledWith('en', 'ja', 'ko');
  });

  it('shows already exists message when updateLanguagePair rejects with 409', async () => {
    mockUpdateLanguagePair.mockRejectedValue(new ApiError(409, 'target language already exists'));
    await render(<EditLanguagePairScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('target-language-ja')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('target-language-ja'));

    await waitFor(() =>
      expect(screen.getByText('Save').props.accessibilityState?.disabled).not.toBe(true)
    );

    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(screen.getByText('A language pair with this learning language already exists.')).toBeTruthy()
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
