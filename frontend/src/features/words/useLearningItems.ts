import { useCallback, useEffect, useRef, useState } from 'react';
import { listLearningItems } from '../../api/learningItems';
import { ApiError } from '../../api/client';
import { useAppLanguage } from '../../i18n';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { LearningItemListItem } from '../../types';

const PAGE_SIZE = 50;

type Status = 'loading' | 'ready' | 'error';

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export function useLearningItems(q: string, deckId?: string, enabled: boolean = true, languageCode?: string) {
  const { t } = useAppLanguage();
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<LearningItemListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (options: { cursor?: string | null; append: boolean; requestId: number }) => {
      const page = await listLearningItems({
        limit: PAGE_SIZE,
        descending: true,
        q: debouncedQ.trim() || undefined,
        cursor: options.cursor ?? undefined,
        deckId,
        languageCode,
      });

      if (options.requestId !== requestIdRef.current) {
        return;
      }

      setItems((prev) => (options.append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.next_cursor);
      nextCursorRef.current = page.next_cursor;
      setStatus('ready');
      setError(null);
    },
    [debouncedQ, deckId, languageCode],
  );

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setNextCursor(null);
      nextCursorRef.current = null;
      setStatus('ready');
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);
    setNextCursor(null);
    nextCursorRef.current = null;

    try {
      await fetchPage({ append: false, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err, t('common.somethingWrong')));
      setStatus('error');
    }
  }, [enabled, fetchPage, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current || status === 'loading') {
      return;
    }

    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      await fetchPage({ cursor, append: true, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err, t('common.somethingWrong')));
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchPage, status, t]);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsRefreshing(true);
    setError(null);

    try {
      await fetchPage({ append: false, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err, t('common.somethingWrong')));
      setStatus('error');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [fetchPage, t]);

  const isSearching = status === 'loading' || q !== debouncedQ;
  const hasMore = nextCursor !== null;

  const maybeLoadMoreFromScroll = useCallback(
    (distanceFromBottom: number, threshold = 320) => {
      if (!hasMore || loadingMoreRef.current || status === 'loading') {
        return;
      }
      if (distanceFromBottom <= threshold) {
        void loadMore();
      }
    },
    [hasMore, loadMore, status],
  );

  return {
    items,
    nextCursor,
    hasMore,
    status,
    isSearching,
    isLoadingMore,
    isRefreshing,
    error,
    loadMore,
    maybeLoadMoreFromScroll,
    refresh,
  };
}
