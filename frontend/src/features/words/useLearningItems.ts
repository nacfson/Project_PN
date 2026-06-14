import { useCallback, useEffect, useRef, useState } from 'react';
import { listLearningItems } from '../../api/learningItems';
import { ApiError } from '../../api/client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { LearningItemListItem } from '../../types';

const PAGE_SIZE = 50;

type Status = 'loading' | 'ready' | 'error';

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong.';
}

export function useLearningItems(q: string) {
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<LearningItemListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (options: { cursor?: string | null; append: boolean; requestId: number }) => {
      const page = await listLearningItems({
        limit: PAGE_SIZE,
        descending: true,
        q: debouncedQ.trim() || undefined,
        cursor: options.cursor ?? undefined,
      });

      if (options.requestId !== requestIdRef.current) {
        return;
      }

      setItems((prev) => (options.append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.next_cursor);
      setStatus('ready');
      setError(null);
    },
    [debouncedQ],
  );

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);
    setNextCursor(null);

    try {
      await fetchPage({ append: false, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err));
      setStatus('error');
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || status === 'loading') {
      return;
    }

    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      await fetchPage({ cursor: nextCursor, append: true, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err));
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchPage, nextCursor, status]);

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
      setError(messageOf(err));
      setStatus('error');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [fetchPage]);

  return {
    items,
    nextCursor,
    status,
    isLoadingMore,
    isRefreshing,
    error,
    loadMore,
    refresh,
  };
}
