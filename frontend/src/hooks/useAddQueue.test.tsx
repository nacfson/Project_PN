import React, { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AddQueueProvider, useAddQueue } from './useAddQueue';
import { addLearningItem, lookupWord } from '../api/words';
import { ApiError } from '../api/client';
import { AppLanguageProvider } from '../i18n';

jest.mock('../api/words', () => ({
  addLearningItem: jest.fn().mockResolvedValue(undefined),
  lookupWord: jest.fn().mockResolvedValue({
    sense_options: [{ word_sense_id: 'sense-1', meaning_order: 1 }],
  }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <AddQueueProvider>{children}</AddQueueProvider>
    </AppLanguageProvider>
  );
}

describe('useAddQueue deck-aware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('passes deckId to addLearningItem when provided', async () => {
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('hello', 'Any', 'deck-123');
    });

    await waitFor(() => {
      expect(addLearningItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'deck-123',
      );
    });
  });

  it('calls addLearningItem without deckId when omitted', async () => {
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('hello', 'Any');
    });

    await waitFor(() => {
      expect(addLearningItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        undefined,
      );
    });
  });

  it('passes deckId to addLearningItem when enqueueMany is used', async () => {
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueueMany(['hello', 'world'], 'Any', 'deck-456');
    });

    await waitFor(() => {
      expect(addLearningItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'deck-456',
      );
    });
  });

  it('passes languageCode to lookupWord when provided', async () => {
    const { lookupWord } = require('../api/words');
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('hello', 'Any', 'deck-123', 'zh');
    });

    await waitFor(() => {
      expect(lookupWord).toHaveBeenCalledWith('hello', expect.objectContaining({
        languageCode: 'zh',
      }));
    });
  });

  it('keeps a coded, user-facing reason when lookup fails', async () => {
    (lookupWord as jest.Mock).mockRejectedValueOnce(
      new ApiError(503, 'word enrichment provider unavailable', 'ADD-403', true),
    );
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('hello', 'Any');
    });

    await waitFor(() => {
      expect(result.current.jobs[0]).toMatchObject({
        status: 'error',
        error: 'ADD-403: The dictionary service is temporarily unavailable. Try again.',
      });
    });
  });

  it('classifies an empty lookup result as no dictionary meaning', async () => {
    (lookupWord as jest.Mock).mockResolvedValueOnce({ sense_options: [] });
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('unlisted', 'Any');
    });

    await waitFor(() => {
      expect(result.current.jobs[0]).toMatchObject({
        status: 'error',
        error: 'ADD-303: No additional dictionary meaning was found.',
      });
    });
  });
});
