'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { mainApi } from '@/api';
import { Mkb10Item } from '@/api';

interface UseMkb10DiagnosesProps {
  searchValue: string;
  isOpen: boolean;
}

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
  const PAGE_SIZE = 20;

  useEffect(() => {
    setDiagnoses([]);
    setPage(1);
    setHasMore(true);
  }, [searchValue]);

  const loadDiagnoses = useCallback(
    async (pageNum: number) => {
      if (!isOpen) return;

      setLoading(true);
      try {
        const response = await mainApi.mkb10.diagnisisList({
          page: pageNum,
          size: PAGE_SIZE,
          searchValue: searchValue.trim() || undefined,
        });

        setDiagnoses((prev) => {
          const existingCodes = new Set(prev.map((d) => d.code));
          const newDiagnoses = response.items.filter(
            (d) => !existingCodes.has(d.code),
          );
          return [...prev, ...newDiagnoses];
        });

        setTotalCount(response.totalCount);
        setHasMore((pageNum + 1) * PAGE_SIZE < response.totalCount);
      } catch (error) {
        console.error('Ошибка загрузки диагнозов:', error);
      } finally {
        setLoading(false);
      }
    },
    [isOpen, searchValue],
  );

  useEffect(() => {
    if (isOpen) {
      loadDiagnoses(page);
    }
  }, [page, isOpen, loadDiagnoses]);

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
