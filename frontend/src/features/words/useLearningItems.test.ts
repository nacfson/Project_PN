import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLearningItems } from './useLearningItems';
import { listLearningItems } from '../../api/learningItems';
import { AppLanguageProvider } from '../../i18n';

jest.mock('../../api/learningItems');

const mockedListLearningItems = jest.mocked(listLearningItems);

function Wrapper({ children }: { children: ReactNode }) {
  return React.createElement(AppLanguageProvider, null, children);
}

describe('useLearningItems', () => {
  let originalPlatform: string;

  beforeAll(() => {
    originalPlatform = Platform.OS;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });
  });

  it('loads items without a deck filter', async () => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = await renderHook(() => useLearningItems(''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedListLearningItems).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: undefined }),
    );
  });

  it('passes languageCode to listLearningItems', async () => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = await renderHook(() => useLearningItems('', undefined, true, 'zh'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedListLearningItems).toHaveBeenCalledWith(
      expect.objectContaining({ languageCode: 'zh' }),
    );
  });

  it('passes deckId to listLearningItems', async () => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = await renderHook(() => useLearningItems('', 'deck-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedListLearningItems).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: 'deck-1' }),
    );
  });

  it('loads the next page when scrolled near the bottom', async () => {
    mockedListLearningItems
      .mockResolvedValueOnce({
        items: [{ id: 'item-1' } as any],
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'item-2' } as any],
        next_cursor: null,
      });

    const { result } = await renderHook(() => useLearningItems(''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.maybeLoadMoreFromScroll(100);
    });
    await waitFor(() => expect(mockedListLearningItems).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
  });

  it('loads the next page via loadMore using the latest cursor ref', async () => {
    mockedListLearningItems
      .mockResolvedValueOnce({
        items: [{ id: 'item-1' } as any],
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'item-2' } as any],
        next_cursor: null,
      });

    const { result } = await renderHook(() => useLearningItems(''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(mockedListLearningItems).toHaveBeenCalledTimes(2));
    expect(mockedListLearningItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' }),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });

  it('auto-loads remaining pages on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    mockedListLearningItems
      .mockResolvedValueOnce({
        items: [{ id: 'item-1' } as any],
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'item-2' } as any],
        next_cursor: null,
      });

    const { result } = await renderHook(() => useLearningItems(''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(mockedListLearningItems).toHaveBeenCalledTimes(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('skips fetching when disabled', async () => {
    const { result } = await renderHook(() => useLearningItems('', undefined, false), {
      wrapper: Wrapper,
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.items).toEqual([]);
    expect(mockedListLearningItems).not.toHaveBeenCalled();
  });
});
