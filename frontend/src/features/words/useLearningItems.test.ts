import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useLearningItems } from './useLearningItems';
import { listLearningItems } from '../../api/learningItems';
import { AppLanguageProvider } from '../../i18n';

jest.mock('../../api/learningItems');
jest.useFakeTimers();

const mockedListLearningItems = jest.mocked(listLearningItems);

function Wrapper({ children }: { children: ReactNode }) {
  return React.createElement(AppLanguageProvider, null, children);
}

describe('useLearningItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('loads items without a deck filter', async () => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = await renderHook(() => useLearningItems(''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedListLearningItems).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: undefined }),
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

  it('skips fetching when disabled', async () => {
    const { result } = await renderHook(() => useLearningItems('', undefined, false), {
      wrapper: Wrapper,
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.items).toEqual([]);
    expect(mockedListLearningItems).not.toHaveBeenCalled();
  });
});
