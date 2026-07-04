import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { EditLanguagePairScreen } from './EditLanguagePairScreen';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { targetLanguage: 'en', displayLanguage: 'ko' } }),
}));

jest.mock('../../api/auth', () => ({
  getLanguageOptions: jest.fn().mockResolvedValue({
    defaults: {},
    allowed: { target_languages: [], definition_languages: [] },
    forced: {},
  }),
}));

const mockUpdateLanguagePair = jest.fn();
jest.mock('../../api/userLanguages', () => ({
  __esModule: true,
  updateLanguagePair: (...args: any[]) => mockUpdateLanguagePair(...args),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('EditLanguagePairScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateLanguagePair.mockResolvedValue(undefined);
  });

  it('calls updateLanguagePair with new target and display language on save', async () => {
    await render(<EditLanguagePairScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('target-language-ja')).toBeTruthy());
    fireEvent.press(screen.getByTestId('target-language-ja'));

    await waitFor(() =>
      expect(screen.getByText('Save').props.accessibilityState?.disabled).not.toBe(true)
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    expect(mockUpdateLanguagePair).toHaveBeenCalledWith('en', 'ja', 'ko');
    expect(mockGoBack).toHaveBeenCalled();
  });
});
