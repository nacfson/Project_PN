import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '../api/client';
import { addLearningItem, lookupWord } from '../api/words';
import { DEFAULT_DEFINITION_LANGUAGE_CODE } from '../config';
import { useAppLanguage } from '../i18n';
import type { WordStatus } from '../components/WordChip';
import type { PosFilter } from '../types';
import { classifyAddError, type AddErrorInfo } from '../utils/addErrors';
import { bestMatch } from '../utils/senses';

export type AddJobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface AddJob {
  id: string;
  text: string;
  pos: PosFilter;
  deckId?: string;
  languageCode?: string;
  sourceContext?: string;
  status: AddJobStatus;
  error?: string;
  errorInfo?: AddErrorInfo;
  wordSenseId?: string;
}

interface AddQueueContextValue {
  jobs: AddJob[];
  pendingCount: number;
  dismissedIds: Set<string>;
  enqueue: (
    text: string,
    pos: PosFilter,
    deckId?: string,
    languageCode?: string,
    sourceContext?: string,
  ) => void;
  enqueueMany: (
    texts: string[],
    pos: PosFilter,
    deckId?: string,
    languageCode?: string,
    sourceContexts?: Record<string, string>,
  ) => void;
  statusOf: (text: string) => WordStatus;
  dismiss: (id: string) => void;
  dismissAllErrors: () => void;
  retryJob: (id: string) => void;
  retryAllFailed: () => void;
  markManualAdded: (text: string, wordSenseId: string) => void;
}

const AddQueueContext = createContext<AddQueueContextValue | null>(null);

function nextJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AddQueueProvider({ children }: { children: ReactNode }) {
  const { t } = useAppLanguage();
  const [jobs, setJobs] = useState<AddJob[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const workerRunning = useRef(false);
  const jobsRef = useRef(jobs);

  const updateJob = useCallback((id: string, patch: Partial<AddJob>) => {
    const next = jobsRef.current.map((job) => (job.id === id ? { ...job, ...patch } : job));
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const runWorker = useCallback(async () => {
    if (workerRunning.current) {
      return;
    }
    workerRunning.current = true;

    try {
      while (true) {
        const next = jobsRef.current.find((job) => job.status === 'queued');
        if (!next) {
          break;
        }

        updateJob(next.id, { status: 'processing', error: undefined, errorInfo: undefined });

        try {
          const response = await lookupWord(next.text, {
            partOfSpeech: next.pos,
            displayLanguageCode: DEFAULT_DEFINITION_LANGUAGE_CODE,
            languageCode: next.languageCode,
            ...(next.sourceContext ? { sourceContext: next.sourceContext } : {}),
          });
          const match = bestMatch(response.sense_options);
          if (!match) {
            const info = classifyAddError(
              new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'),
            );
            updateJob(next.id, {
              status: 'error',
              error: t(info.messageKey),
              errorInfo: info,
            });
            continue;
          }

          const translationMissing =
            Boolean(response.translation_missing) ||
            (response.sense_options.some((o) => o.has_localized_translation === false) &&
              response.sense_options.every((o) => o.has_localized_translation === false));
          if (translationMissing) {
            const info = classifyAddError(
              new ApiError(422, 'no localized meaning', 'ADD-304', false, 'translation_unavailable'),
            );
            updateJob(next.id, {
              status: 'error',
              error: t(info.messageKey),
              errorInfo: info,
            });
            continue;
          }

          if (next.sourceContext) {
            await addLearningItem(
              match.word_sense_id,
              DEFAULT_DEFINITION_LANGUAGE_CODE,
              next.deckId,
              next.sourceContext,
            );
          } else {
            await addLearningItem(
              match.word_sense_id,
              DEFAULT_DEFINITION_LANGUAGE_CODE,
              next.deckId,
            );
          }
          updateJob(next.id, {
            status: 'done',
            wordSenseId: match.word_sense_id,
            error: undefined,
            errorInfo: undefined,
          });
        } catch (err) {
          const info = classifyAddError(err);
          updateJob(next.id, {
            status: 'error',
            error: t(info.messageKey),
            errorInfo: info,
          });
        }
      }
    } finally {
      workerRunning.current = false;
      if (jobsRef.current.some((job) => job.status === 'queued')) {
        void runWorker();
      }
    }
  }, [t, updateJob]);

  const kickWorker = useCallback(() => {
    void runWorker();
  }, [runWorker]);

  const enqueue = useCallback(
    (
      text: string,
      pos: PosFilter,
      deckId?: string,
      languageCode?: string,
      sourceContext?: string,
    ) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return;
      }
      const trimmedContext = sourceContext?.trim();

      const job: AddJob = {
        id: nextJobId(),
        text: trimmed,
        pos,
        deckId,
        languageCode,
        ...(trimmedContext ? { sourceContext: trimmedContext } : {}),
        status: 'queued',
      };

      const next = [...jobsRef.current, job];
      jobsRef.current = next;
      setJobs(next);
      kickWorker();
    },
    [kickWorker],
  );

  const enqueueMany = useCallback(
    (
      texts: string[],
      pos: PosFilter,
      deckId?: string,
      languageCode?: string,
      sourceContexts?: Record<string, string>,
    ) => {
      const trimmed = texts.map((text) => text.trim()).filter((text) => text.length > 0);
      if (trimmed.length === 0) {
        return;
      }

      const newJobs: AddJob[] = trimmed.map((text) => {
        const ctx = sourceContexts?.[text]?.trim();
        return {
          id: nextJobId(),
          text,
          pos,
          deckId,
          languageCode,
          ...(ctx ? { sourceContext: ctx } : {}),
          status: 'queued' as const,
        };
      });

      const next = [...jobsRef.current, ...newJobs];
      jobsRef.current = next;
      setJobs(next);
      kickWorker();
    },
    [kickWorker],
  );

  const statusOf = useCallback(
    (text: string): WordStatus => {
      const trimmed = text.trim();
      const matching = jobs.filter((job) => job.text === trimmed);
      if (matching.length === 0) {
        return 'idle';
      }

      const latest = matching[matching.length - 1];
      switch (latest.status) {
        case 'queued':
        case 'processing':
          return 'pending';
        case 'done':
          return 'added';
        case 'error':
          return 'error';
      }
    },
    [jobs],
  );

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const dismissAllErrors = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const job of jobsRef.current) {
        if (job.status === 'error') {
          next.add(job.id);
        }
      }
      return next;
    });
  }, []);

  const retryJob = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      updateJob(id, { status: 'queued', error: undefined, errorInfo: undefined });
      kickWorker();
    },
    [kickWorker, updateJob],
  );

  const retryAllFailed = useCallback(() => {
    const retryIds = new Set<string>();
    const next = jobsRef.current.map((job) => {
      if (job.status === 'error' && !dismissedIds.has(job.id) && (job.errorInfo?.retryable ?? true)) {
        retryIds.add(job.id);
        return { ...job, status: 'queued' as const, error: undefined, errorInfo: undefined };
      }
      return job;
    });
    if (retryIds.size === 0) return;
    jobsRef.current = next;
    setJobs(next);
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      for (const id of retryIds) {
        updated.delete(id);
      }
      return updated;
    });
    kickWorker();
  }, [dismissedIds, kickWorker]);

  const markManualAdded = useCallback((text: string, wordSenseId: string) => {
    const trimmed = text.trim();
    const matchingIndices = jobsRef.current
      .map((job, idx) => (job.text === trimmed ? idx : -1))
      .filter((idx) => idx !== -1);
    if (matchingIndices.length === 0) {
      return;
    }
    const targetIdx = matchingIndices[matchingIndices.length - 1];
    const targetJob = jobsRef.current[targetIdx];
    const next = jobsRef.current.map((job, idx) =>
      idx === targetIdx
        ? { ...job, status: 'done' as const, wordSenseId, error: undefined, errorInfo: undefined }
        : job,
    );
    jobsRef.current = next;
    setJobs(next);
    setDismissedIds((prev) => {
      if (!prev.has(targetJob.id)) return prev;
      const updated = new Set(prev);
      updated.delete(targetJob.id);
      return updated;
    });
  }, []);

  const pendingCount = useMemo(
    () => jobs.filter((job) => job.status === 'queued' || job.status === 'processing').length,
    [jobs],
  );

  const value = useMemo(
    () => ({
      jobs,
      pendingCount,
      dismissedIds,
      enqueue,
      enqueueMany,
      statusOf,
      dismiss,
      dismissAllErrors,
      retryJob,
      retryAllFailed,
      markManualAdded,
    }),
    [
      jobs,
      pendingCount,
      dismissedIds,
      enqueue,
      enqueueMany,
      statusOf,
      dismiss,
      dismissAllErrors,
      retryJob,
      retryAllFailed,
      markManualAdded,
    ],
  );

  return <AddQueueContext.Provider value={value}>{children}</AddQueueContext.Provider>;
}

export function useAddQueue(): AddQueueContextValue {
  const context = useContext(AddQueueContext);
  if (!context) {
    throw new Error('useAddQueue must be used within AddQueueProvider');
  }
  return context;
}
