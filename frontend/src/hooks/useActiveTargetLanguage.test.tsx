import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useActiveTargetLanguage } from './useActiveTargetLanguage';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { UserLanguage } from '../types/auth';

const mockGetUserLanguages = jest.fn();
jest.mock('../api/userLanguages', () => ({
  __esModule: true,
  getUserLanguages: () => mockGetUserLanguages(),
  setActiveUserLanguage: jest.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

function makeLanguage(partial: Omit<UserLanguage, 'user_id' | 'created_at' | 'updated_at'>): UserLanguage {
  return {
    user_id: 'u1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe('useActiveTargetLanguage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the active target and display language', async () => {
    mockGetUserLanguages.mockResolvedValue([
      makeLanguage({ target_language: 'en', display_language: 'ko', is_active: true }),
      makeLanguage({ target_language: 'es', display_language: 'en', is_active: false }),
    ]);

    const { result } = await renderHook(() => useActiveTargetLanguage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('en');
    expect(result.current.displayLanguage).toBe('ko');
  });

  it('falls back to the first language pair when none is active', async () => {
    mockGetUserLanguages.mockResolvedValue([
      makeLanguage({ target_language: 'es', display_language: 'en', is_active: false }),
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
