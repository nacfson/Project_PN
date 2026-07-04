import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { LanguageProvider, useLanguage } from './LanguageContext';

const mockGetUserLanguages = jest.fn();
jest.mock('../api/userLanguages', () => ({
  __esModule: true,
  getUserLanguages: () => mockGetUserLanguages(),
  setActiveUserLanguage: jest.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('LanguageContext', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shares the active target language across consumers', async () => {
    mockGetUserLanguages.mockResolvedValue([
      { target_language: 'en', display_language: 'ko', is_active: false },
      { target_language: 'ja', display_language: 'ko', is_active: true },
    ]);
    const { result } = await renderHook(() => useLanguage(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('ja');
  });

  it('falls back to the first language pair when none is active', async () => {
    mockGetUserLanguages.mockResolvedValue([
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);
    const { result } = await renderHook(() => useLanguage(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('es');
    expect(result.current.displayLanguage).toBe('en');
  });

  it('surfaces fetch errors', async () => {
    mockGetUserLanguages.mockRejectedValue(new Error('network down'));
    const { result } = await renderHook(() => useLanguage(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.loading).toBe(false);
  });
});
