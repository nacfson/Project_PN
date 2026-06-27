import { renderHook, waitFor } from '@testing-library/react-native';
import { useActiveTargetLanguage } from './useActiveTargetLanguage';
import { getUserLanguages } from '../api/userLanguages';

jest.mock('../api/userLanguages');

const mockedGetUserLanguages = jest.mocked(getUserLanguages);

describe('useActiveTargetLanguage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the active target and display language', async () => {
    mockedGetUserLanguages.mockResolvedValue([
      { target_language: 'en', display_language: 'ko', is_active: true },
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);

    const { result } = await renderHook(() => useActiveTargetLanguage());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('en');
    expect(result.current.displayLanguage).toBe('ko');
  });

  it('falls back to the first language pair when none is active', async () => {
    mockedGetUserLanguages.mockResolvedValue([
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);

    const { result } = await renderHook(() => useActiveTargetLanguage());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('es');
  });

  it('surfaces fetch errors', async () => {
    mockedGetUserLanguages.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useActiveTargetLanguage());

    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.loading).toBe(false);
  });

  it('starts in loading state while language pairs are loading', async () => {
    mockedGetUserLanguages.mockReturnValue(new Promise(() => {}));

    const { result } = await renderHook(() => useActiveTargetLanguage());

    expect(result.current.loading).toBe(true);
  });
});
