import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppLanguageProvider } from '../i18n';
import { addLearningItem, lookupWord } from '../api/words';
import { useSenseFlow } from './useSenseFlow';

jest.mock('../api/words', () => ({
  addLearningItem: jest.fn(),
  lookupWord: jest.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <AppLanguageProvider>{children}</AppLanguageProvider>;
}

const senseOption = {
  word_id: 'w1',
  word_sense_id: 'sense-1',
  language_code: 'en',
  lemma: 'charge',
  normalized_text: 'charge',
  part_of_speech: 'verb',
  pronunciation: null,
  display_language_code: 'ko',
  definition: 'to store energy',
  short_definition: 'store',
  localized_definition: '충전하다',
  localized_short_definition: '충전하다',
  cefr_level: null,
  meaning_order: 1,
  examples: [],
};

describe('useSenseFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (lookupWord as jest.Mock).mockResolvedValue({ sense_options: [senseOption] });
    (addLearningItem as jest.Mock).mockResolvedValue({ id: 'item-1', word_sense_id: 'sense-1' });
  });

  it('clears lookingUp after lookup and does not leave Find-button loading stuck', async () => {
    const { result } = await renderHook(() => useSenseFlow(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.lookup('charge', 'Any');
    });

    expect(result.current.lookingUp).toBe(false);
    expect(result.current.confirming).toBe(false);
    expect(result.current.generating).toBe(false);
    expect(result.current.pickerVisible).toBe(true);
  });

  it('ignores close while confirming so loading cannot stick', async () => {
    let resolveAdd: (value: unknown) => void = () => {};
    (addLearningItem as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        }),
    );

    const { result } = await renderHook(() => useSenseFlow(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.lookup('charge', 'Any');
    });

    let confirmPromise!: Promise<void>;
    await act(async () => {
      confirmPromise = result.current.confirm('sense-1', 'deck-1');
    });

    await waitFor(() => expect(result.current.confirming).toBe(true));

    await act(async () => {
      result.current.close();
    });

    expect(result.current.pickerVisible).toBe(true);
    expect(result.current.confirming).toBe(true);

    await act(async () => {
      resolveAdd({ id: 'item-1', word_sense_id: 'sense-1' });
      await confirmPromise;
    });

    expect(result.current.confirming).toBe(false);
    expect(result.current.generating).toBe(false);
    expect(result.current.pickerVisible).toBe(false);
  });

  it('clears confirming after a failed add so the picker can be dismissed', async () => {
    (addLearningItem as jest.Mock).mockRejectedValue(new Error('network'));
    const { result } = await renderHook(() => useSenseFlow(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.lookup('charge', 'Any');
    });

    await act(async () => {
      await result.current.confirm('sense-1', 'deck-1');
    });

    expect(result.current.confirming).toBe(false);
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      result.current.close();
    });
    expect(result.current.pickerVisible).toBe(false);
    expect(result.current.generating).toBe(false);
  });
});
