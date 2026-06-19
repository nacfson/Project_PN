import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { addLearningItem, lookupWord } from '../api/words';
import { ApiError } from '../api/client';
import { DEFAULT_DEFINITION_LANGUAGE_CODE } from '../config';
import { useAppLanguage } from '../i18n';
import type { WordStatus } from '../components/WordChip';
import type { PosFilter } from '../types';
import { bestMatch } from '../utils/senses';

export type AddJobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface AddJob {
  id: string;
  text: string;
  pos: PosFilter;
  status: AddJobStatus;
  error?: string;
  wordSenseId?: string;
}

interface AddQueueContextValue {
  jobs: AddJob[];
  pendingCount: number;
  dismissedIds: Set<string>;
  enqueue: (text: string, pos: PosFilter) => void;
  enqueueMany: (texts: string[], pos: PosFilter) => void;
  statusOf: (text: string) => WordStatus;
  dismiss: (id: string) => void;
}

const AddQueueContext = createContext<AddQueueContextValue | null>(null);

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

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

  jobsRef.current = jobs;

  const updateJob = useCallback((id: string, patch: Partial<AddJob>) => {
    setJobs((prev) => {
      const next = prev.map((job) => (job.id === id ? { ...job, ...patch } : job));
      jobsRef.current = next;
      return next;
    });
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

        updateJob(next.id, { status: 'processing' });

        try {
          const response = await lookupWord(next.text, {
            partOfSpeech: next.pos,
            displayLanguageCode: DEFAULT_DEFINITION_LANGUAGE_CODE,
          });
          const match = bestMatch(response.sense_options);
          if (!match) {
            updateJob(next.id, { status: 'error', error: t('sense.noneFound') });
            continue;
          }

          await addLearningItem(match.word_sense_id, DEFAULT_DEFINITION_LANGUAGE_CODE);
          updateJob(next.id, { status: 'done', wordSenseId: match.word_sense_id });
        } catch (err) {
          updateJob(next.id, { status: 'error', error: messageOf(err, t('common.somethingWrong')) });
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
    (text: string, pos: PosFilter) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return;
      }

      const job: AddJob = {
        id: nextJobId(),
        text: trimmed,
        pos,
        status: 'queued',
      };

      setJobs((prev) => {
        const next = [...prev, job];
        jobsRef.current = next;
        return next;
      });
      kickWorker();
    },
    [kickWorker],
  );

  const enqueueMany = useCallback(
    (texts: string[], pos: PosFilter) => {
      const trimmed = texts.map((text) => text.trim()).filter((text) => text.length > 0);
      if (trimmed.length === 0) {
        return;
      }

      const newJobs: AddJob[] = trimmed.map((text) => ({
        id: nextJobId(),
        text,
        pos,
        status: 'queued' as const,
      }));

      setJobs((prev) => {
        const next = [...prev, ...newJobs];
        jobsRef.current = next;
        return next;
      });
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
    }),
    [jobs, pendingCount, dismissedIds, enqueue, enqueueMany, statusOf, dismiss],
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
