import { useCallback, useRef, useState } from 'react';
import { addLearningItem, lookupWord } from '../api/words';
import { ApiError } from '../api/client';
import { useAppLanguage } from '../i18n';
import type { PartOfSpeech, PosFilter, SenseOption } from '../types';

interface SenseFlowCallbacks {
  // Called after a learning item is successfully created.
  onAdded?: (wordSenseId: string) => void;
  // Called when the picker is dismissed without adding.
  onDismiss?: () => void;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export function useSenseFlow(callbacks: SenseFlowCallbacks = {}) {
  const { t } = useAppLanguage();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SenseOption[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastText = useRef('');
  const lastPos = useRef<PosFilter>('Any');

  const lookup = useCallback(async (text: string, posFilter: PosFilter): Promise<boolean> => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return false;
    }
    lastText.current = trimmed;
    lastPos.current = posFilter;
    setQuery(trimmed);
    setError(null);
    setGenerating(true);
    setOptions([]);
    setPickerVisible(true);
    try {
      const response = await lookupWord(trimmed, { partOfSpeech: posFilter });
      setOptions(response.sense_options);
      return true;
    } catch (err) {
      setError(messageOf(err, t('common.somethingWrong')));
      return false;
    } finally {
      setGenerating(false);
    }
  }, [t]);

  const forceExisting = useCallback(async (wordId: string) => {
    setError(null);
    setGenerating(true);
    try {
      const response = await lookupWord(lastText.current, { wordId, force: true });
      setOptions(response.sense_options);
    } catch (err) {
      setError(messageOf(err, t('common.somethingWrong')));
    } finally {
      setGenerating(false);
    }
  }, [t]);

  const forceWithPos = useCallback(async (pos: PartOfSpeech) => {
    setError(null);
    setGenerating(true);
    try {
      const response = await lookupWord(lastText.current, { partOfSpeech: pos, force: true });
      setOptions(response.sense_options);
    } catch (err) {
      setError(messageOf(err, t('common.somethingWrong')));
    } finally {
      setGenerating(false);
    }
  }, [t]);

  const confirm = useCallback(
    async (wordSenseId: string) => {
      setError(null);
      setGenerating(true);
      try {
        await addLearningItem(wordSenseId);
        setPickerVisible(false);
        callbacks.onAdded?.(wordSenseId);
      } catch (err) {
        setError(messageOf(err, t('common.somethingWrong')));
      } finally {
        setGenerating(false);
      }
    },
    [callbacks, t],
  );

  const close = useCallback(() => {
    setPickerVisible(false);
    callbacks.onDismiss?.();
  }, [callbacks]);

  return {
    pickerVisible,
    query,
    options,
    generating,
    error,
    lookup,
    forceExisting,
    forceWithPos,
    confirm,
    close,
  };
}

export type { PartOfSpeech };
