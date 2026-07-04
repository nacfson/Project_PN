import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useActiveTargetLanguage } from './useActiveTargetLanguage';
import { LanguageProvider } from '../contexts/LanguageContext';

const mockGetUserLanguages = jest.fn();
jest.mock('../api/userLanguages', () => ({
  __esModule: true,
  getUserLanguages: () => mockGetUserLanguages(),
  setActiveUserLanguage: jest.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('useActiveTargetLanguage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the active target and display language', async () => {
    mockGetUserLanguages.mockResolvedValue([
      { target_language: 'en', display_language: 'ko', is_active: true },
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);

    const { result } = await renderHook(() => useActiveTargetLanguage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('en');
    expect(result.current.displayLanguage).toBe('ko');
  });

  it('falls back to the first language pair when none is active', async () => {
    mockGetUserLanguages.mockResolvedValue([
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);

    const { result } = await renderHook(() => useActiveTargetLanguage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('es');
  });

  it('surfaces fetch errors', async () => {
    mockGetUserLanguages.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useActiveTargetLanguage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.loading).toBe(false);
  });

  it('starts in loading state while language pairs are loading', async () => {
    mockGetUserLanguages.mockReturnValue(new Promise(() => {}));

    const { result } = await renderHook(() => useActiveTargetLanguage(), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
  });
});
