import React, { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AddQueueProvider, useAddQueue } from './useAddQueue';
import { addLearningItem } from '../api/words';
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
  it('passes deckId to addLearningItem', async () => {
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
});
