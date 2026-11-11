'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { completedApi, type CompletedItem } from '@/api/completed-api';
import { isAbortError } from '@/api/base-client';
import { completedQuery, type CompletedFilters } from '@/lib/clinic-access';
import { appendUniqueItems } from '@/lib/incremental-questionnaires';

interface Result {
  key: string;
  items: CompletedItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}

export function useCompletedQuestionnaireList(
  scope: string | null,
  filters: CompletedFilters,
  refresh: number,
  completionOffset?: number,
) {
  const [result, setResult] = useState<Result | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const query = useMemo(
    () => ({
      ...completedQuery(filters, 1),
      ...(completionOffset === undefined
        ? {}
        : {
            by_completion: 'true',
            exclude_dental: 'true',
            utc_offset_minutes: completionOffset,
          }),
    }),
    [filters, completionOffset],
  );
  const key = JSON.stringify([scope, query, refresh, retryKey]);
  const active = useRef<{
    key: string;
    controller: AbortController;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    const request = { key, controller, loading: true };
    active.current = request;
    completedApi
      .list(scope, query, { signal: controller.signal })
      .then((response) => {
        if (active.current !== request || controller.signal.aborted) return;
        setResult({
          key,
          items: appendUniqueItems([], response.items),
          page: 1,
          hasMore:
            response.items.length > 0 &&
            response.page * response.page_size < response.total,
          loading: false,
          error: false,
        });
      })
      .catch((error) => {
        if (
          isAbortError(error) ||
          active.current !== request ||
          controller.signal.aborted
        )
          return;
        setResult({
          key,
          items: [],
          page: 0,
          hasMore: false,
          loading: false,
          error: true,
        });
      })
      .finally(() => {
        if (active.current === request) request.loading = false;
      });
    return () => {
      controller.abort();
      if (active.current === request) active.current = null;
    };
  }, [scope, query, key]);

  const current = result?.key === key ? result : null;
  const loadMore = useCallback(() => {
    const request = active.current;
    if (
      !scope ||
      !current?.hasMore ||
      current.error ||
      !request ||
      request.key !== key ||
      request.loading
    )
      return;
    request.loading = true;
    setResult((previous) =>
      previous?.key === key ? { ...previous, loading: true } : previous,
    );
    const nextPage = current.page + 1;
    completedApi
      .list(
        scope,
        { ...query, page: nextPage },
        { signal: request.controller.signal },
      )
      .then((response) => {
        if (active.current !== request || request.controller.signal.aborted)
          return;
        setResult((previous) =>
          previous?.key === key
            ? {
                ...previous,
                items: appendUniqueItems(previous.items, response.items),
                page: nextPage,
                hasMore:
                  response.items.length > 0 &&
                  response.page * response.page_size < response.total,
                loading: false,
                error: false,
              }
            : previous,
        );
      })
      .catch((error) => {
        if (
          isAbortError(error) ||
          active.current !== request ||
          request.controller.signal.aborted
        )
          return;
        setResult((previous) =>
          previous?.key === key
            ? { ...previous, loading: false, error: true }
            : previous,
        );
      })
      .finally(() => {
        if (active.current === request) request.loading = false;
      });
  }, [scope, current, key, query]);
  const retry = useCallback(() => {
    if (current?.page && current.items.length) {
      setResult((previous) =>
        previous?.key === key ? { ...previous, error: false } : previous,
      );
    } else setRetryKey((value) => value + 1);
  }, [current, key]);
  return {
    items: current?.items ?? [],
    loading: scope !== null && (!current || current.loading),
    error: current?.error ?? false,
    hasMore: current?.hasMore ?? false,
    loadMore,
    retry,
  };
}
