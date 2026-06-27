import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  let matchMediaListeners: any[] = [];
  let matchMediaMatches = false;
  let nativeListeners: any[] = [];
  let isReduceMotionEnabledValue = false;

  function setMatchMediaMatches(matches: boolean) {
    matchMediaMatches = matches;
  }

  function triggerMediaQueryChange(matches: boolean) {
    const event = { matches, media: '(prefers-reduced-motion: reduce)' };
    matchMediaListeners.forEach((listener) => listener(event));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    matchMediaListeners = [];
    matchMediaMatches = false;
    nativeListeners = [];
    isReduceMotionEnabledValue = false;

    (Platform.OS as string) = 'web';

    Object.defineProperty(global, 'window', {
      writable: true,
      value: {
        matchMedia: jest.fn().mockImplementation((query: string) => ({
          matches: matchMediaMatches,
          media: query,
          addEventListener: jest.fn((_event: any, listener: any) => {
            matchMediaListeners.push(listener);
          }),
          removeEventListener: jest.fn((_event: any, listener: any) => {
            matchMediaListeners = matchMediaListeners.filter((l) => l !== listener);
          }),
        })),
      },
    });

    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(() => Promise.resolve(isReduceMotionEnabledValue));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event: any, listener: any) => {
      nativeListeners.push(listener);
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    matchMediaListeners = [];
    nativeListeners = [];
    jest.restoreAllMocks();
    cleanup();
  });

  it('returns false on web when prefers-reduced-motion does not match', async () => {
    setMatchMediaMatches(false);

    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('returns true on web when prefers-reduced-motion matches', async () => {
    setMatchMediaMatches(true);

    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it('updates when the prefers-reduced-motion media query changes', async () => {
    setMatchMediaMatches(false);

    const { result } = await renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    await act(async () => {
      triggerMediaQueryChange(true);
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('reads AccessibilityInfo.isReduceMotionEnabled on native', async () => {
    (Platform.OS as string) = 'ios';
    isReduceMotionEnabledValue = false;

    const { result } = await renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(false));

    await act(async () => {
      nativeListeners.forEach((listener) => listener(true));
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('cleans up native event listener on unmount', async () => {
    (Platform.OS as string) = 'android';
    const remove = jest.fn();

    isReduceMotionEnabledValue = false;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove } as any);

    const { unmount } = await renderHook(() => useReducedMotion());

    unmount();

    await waitFor(() => expect(remove).toHaveBeenCalled());
  });
});
