'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** Root margin for intersection observer (default: '400px') */
  rootMargin?: string;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading: boolean;
}

interface UseInfiniteScrollReturn {
  /** Ref to attach to the sentinel element */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Whether loading more items */
  loadingMore: boolean;
  /** Function to load more items */
  loadMore: () => void;
  /** Current page number */
  page: number;
  /** Reset page to 1 */
  resetPage: () => void;
}

/**
 * Custom hook for infinite scroll functionality
 * Provides consistent infinite scroll behavior across product grids
 */
export function useInfiniteScroll(
  onLoadMore: (page: number) => Promise<void>,
  options: UseInfiniteScrollOptions
): UseInfiniteScrollReturn {
  const { rootMargin = '400px', hasMore, isLoading } = options;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const resetPage = useCallback(() => {
    setPage(1);
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  const loadMore = useCallback(async () => {
    // Guard against duplicate fetches
    if (loadingMoreRef.current || !hasMore || isLoading) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    const nextPage = page + 1;
    setPage(nextPage);

    try {
      await onLoadMore(nextPage);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, isLoading, page, onLoadMore]);

  // Set up intersection observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMoreRef.current && hasMore) {
          loadMore();
        }
      },
      { rootMargin }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, rootMargin]);

  return {
    sentinelRef,
    loadingMore,
    loadMore,
    page,
    resetPage,
  };
}
