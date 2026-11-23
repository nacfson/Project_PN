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

  it('keeps explicit errorInfo when lookup fails', async () => {
    (lookupWord as jest.Mock).mockRejectedValueOnce(
      new ApiError(503, 'word enrichment provider unavailable', 'ADD-403', true, 'provider_unavailable'),
    );
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('hello', 'Any');
    });

    await waitFor(() => {
      expect(result.current.jobs[0]).toMatchObject({
        status: 'error',
        error: 'The dictionary service could not be reached right now. Try again or write your own meaning.',
        errorInfo: expect.objectContaining({
          code: 'ADD-403',
          category: 'provider_unavailable',
          retryable: true,
          canManualAdd: true,
        }),
      });
    });
  });

  it('classifies an empty lookup result as ADD-309 word not found', async () => {
    (lookupWord as jest.Mock).mockResolvedValueOnce({ sense_options: [] });
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('unlisted', 'Any');
    });

    await waitFor(() => {
      expect(result.current.jobs[0]).toMatchObject({
        status: 'error',
        error: "We couldn't find this word in the dictionary. Check the spelling or write your own meaning.",
        errorInfo: expect.objectContaining({
          code: 'ADD-309',
          category: 'not_found',
          canManualAdd: true,
        }),
      });
    });
  });

  it('classifies translation_missing lookup as ADD-304 and supports retryJob and markManualAdded', async () => {
    (lookupWord as jest.Mock).mockResolvedValueOnce({
      translation_missing: true,
      sense_options: [
        {
          word_sense_id: 'sense-en',
          meaning_order: 1,
          has_localized_translation: false,
        },
      ],
    });
    const { result } = await renderHook(() => useAddQueue(), { wrapper: Wrapper });

    await act(() => {
      result.current.enqueue('ephemeral', 'Any', 'deck-1', 'en', 'Fame is ephemeral.');
    });

    await waitFor(() => {
      expect(result.current.jobs[0]).toMatchObject({
        status: 'error',
        sourceContext: 'Fame is ephemeral.',
        errorInfo: expect.objectContaining({
          code: 'ADD-304',
          category: 'translation_missing',
        }),
      });
    });

    await act(() => {
      result.current.markManualAdded('ephemeral', 'manual-sense-1');
    });
    expect(result.current.statusOf('ephemeral')).toBe('added');

    (lookupWord as jest.Mock).mockRejectedValueOnce(new ApiError(504, 'timeout', 'ADD-405', true));
    await act(() => {
      result.current.enqueue('slow', 'Any');
    });
    await waitFor(() => expect(result.current.jobs[1].status).toBe('error'));

    (lookupWord as jest.Mock).mockResolvedValueOnce({
      sense_options: [{ word_sense_id: 'sense-1', meaning_order: 1 }],
    });
    await act(() => {
      result.current.retryAllFailed();
    });
    await waitFor(() => {
      expect(result.current.jobs[1].status).toBe('done');
    });
  });
});
