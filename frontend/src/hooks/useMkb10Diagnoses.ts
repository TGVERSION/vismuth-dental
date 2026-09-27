'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { mainApi } from '@/api';
import { isAbortError } from '@/api/base-client';
import { Mkb10Item } from '@/api';
import { logError } from '@/lib/logger';
import { hasMorePages } from '@/lib/protocol-draft';

interface UseMkb10DiagnosesProps {
  searchValue: string;
  isOpen: boolean;
}

const PAGE_SIZE = 20;

export const useMkb10Diagnoses = ({
  searchValue,
  isOpen,
}: UseMkb10DiagnosesProps) => {
  const [diagnoses, setDiagnoses] = useState<Mkb10Item[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ответы по устаревшей строке поиска не должны подмешиваться в список,
  // который уже относится к новому запросу.
  const requestIdRef = useRef(0);

  useEffect(() => {
    setDiagnoses([]);
    setPage(1);
    setHasMore(true);
  }, [searchValue]);

  const loadDiagnoses = useCallback(
    async (pageNum: number) => {
      if (!isOpen) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      try {
        const response = await mainApi.mkb10.diagnisisList(
          {
            page: pageNum,
            size: PAGE_SIZE,
            searchValue: searchValue.trim() || undefined,
          },
          { signal: controller.signal },
        );

        if (requestId !== requestIdRef.current) return;

        setDiagnoses((prev) => {
          const existingCodes = new Set(prev.map((d) => d.code));
          const newDiagnoses = response.items.filter(
            (d) => !existingCodes.has(d.code),
          );
          return [...prev, ...newDiagnoses];
        });

        setTotalCount(response.totalCount);
        setHasMore(hasMorePages(pageNum, PAGE_SIZE, response.totalCount));
      } catch (error) {
        if (isAbortError(error)) return;
        if (requestId !== requestIdRef.current) return;
        logError('Ошибка загрузки диагнозов:', error);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [isOpen, searchValue],
  );

  useEffect(() => {
    if (isOpen) {
      loadDiagnoses(page);
    }
  }, [page, isOpen, loadDiagnoses]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (sentinelRef.current && hasMore && !loading) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            setPage((prev) => prev + 1);
          }
        },
        {
          root: null,
          rootMargin: '300px',
          threshold: 0.01,
        },
      );
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading]);

  return {
    diagnoses,
    loading,
    hasMore,
    totalCount,
    sentinelRef,
  };
};
