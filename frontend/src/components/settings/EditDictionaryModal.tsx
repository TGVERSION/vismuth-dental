'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import Image from 'next/image';
import { mainApi } from '@/api';
import type { DictionaryNames } from '@/api';

const LIMIT = 100;

interface ModalData {
  dictionaryName: string;
  columns: { id: string; name: string; width: number }[];
  rows: string[][];
  totalCount: number | null;
  loadedCount: number;
  isLoadError: boolean;
}

const makeInitialData = (dictionary?: DictionaryNames | null): ModalData => ({
  dictionaryName: dictionary?.name ?? '',
  columns: [],
  rows: [],
  totalCount: null,
  loadedCount: 0,
  isLoadError: false,
});

interface EditDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  dictionary?: DictionaryNames | null;
}

export function EditDictionaryModal({
  isOpen,
  onClose,
  dictionary,
}: EditDictionaryModalProps) {
  const [data, setData] = useState<ModalData>(() =>
    makeInitialData(dictionary),
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const keysRef = useRef<string[]>([]);

  const isLoading =
    !!dictionary && data.totalCount === null && !data.isLoadError;

  useEffect(() => {
    if (!dictionary) return;

    let cancelled = false;
    keysRef.current = [];

    mainApi.dictionary
      .getDictionaryRef(dictionary.name, { limit: LIMIT, offset: 0 })
      .then((res) => {
        if (cancelled) return;

        if (res.items.length === 0) {
          setData((prev) => ({ ...prev, totalCount: res.total }));
          return;
        }

        const keys = Object.keys(res.items[0]).filter((k) => k !== 'row_id');
        keysRef.current = keys;
        const columns = keys.map((key, idx) => ({
          id: `col-${idx}`,
          name: key,
          width: 150,
        }));
        const rows = res.items.map((item) =>
          keys.map((key) => String(item[key] ?? '')),
        );

        setData((prev) => ({
          ...prev,
          columns,
          rows,
          totalCount: res.total,
          loadedCount: rows.length,
        }));
      })
      .catch(() => {
        if (!cancelled) setData((prev) => ({ ...prev, isLoadError: true }));
      });

    return () => {
      cancelled = true;
    };
  }, [dictionary]);

  const loadMore = useCallback(() => {
    if (!dictionary || isLoadingMore || isLoading) return;
    if (data.totalCount !== null && data.loadedCount >= data.totalCount) return;

    setIsLoadingMore(true);
    setLoadMoreError(false);
    mainApi.dictionary
      .getDictionaryRef(dictionary.name, {
        limit: LIMIT,
        offset: data.loadedCount,
      })
      .then((res) => {
        const keys = keysRef.current;
        if (!keys.length) return;
        const newRows = res.items.map((item) =>
          keys.map((key) => String(item[key] ?? '')),
        );
        setData((prev) => ({
          ...prev,
          rows: [...prev.rows, ...newRows],
          loadedCount: prev.loadedCount + newRows.length,
        }));
      })
      .catch(() => setLoadMoreError(true))
      .finally(() => setIsLoadingMore(false));
  }, [dictionary, isLoadingMore, isLoading, data.totalCount, data.loadedCount]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  const hasMore =
    data.totalCount !== null && data.loadedCount < data.totalCount;

  return (
    <div
      onClick={handleOverlayClick}
      className="modal-overlay fixed inset-0 z-[var(--ui-z-modal)] flex items-start justify-center overflow-y-auto bg-[color:var(--ui-color-alabaster-dark-800)]/20 px-4 py-8"
    >
      <div className="animate-fade-in h-auto w-full max-w-160 rounded-2xl bg-white p-6 shadow-[var(--ui-shadow)] sm:p-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="vismuth-icon-button"
            aria-label="Закрыть"
          >
            <Image alt="close" src="/close.svg" width={20} height={20} />
          </button>
        </div>
        <div className="mr-5">
          <h2 className="mb-6 text-[length:var(--ui-font-size-31)] font-medium text-[var(--ui-color-alabaster-dark-800)]">
            Справочник
          </h2>

          <p className="mb-3 text-sm text-[var(--ui-color-alabaster-950)]">
            Справочник доступен для просмотра.
          </p>
          <p className="mb-4 font-medium">{data.dictionaryName}</p>
          {data.totalCount !== null && (
            <p className="text-xs text-[var(--ui-color-alabaster-950)] mb-3">
              Показано{' '}
              <span className="text-[var(--ui-color-blue-600)]">
                {data.loadedCount.toLocaleString('ru-RU')}
              </span>{' '}
              из{' '}
              <span className="text-[var(--ui-color-blue-600)]">
                {data.totalCount.toLocaleString('ru-RU')}
              </span>
            </p>
          )}

          <div className="mb-5">
            {isLoading ? (
              <p className="text-sm text-gray-400 py-8 text-center">
                Загрузка данных...
              </p>
            ) : data.isLoadError ? (
              <p className="text-sm text-red-400 py-8 text-center">
                Не удалось загрузить данные
              </p>
            ) : (
              <>
                <div
                  className="max-h-96 overflow-auto rounded-lg border border-[var(--ui-color-slate-200)]"
                  tabIndex={0}
                  aria-label={`Данные справочника ${data.dictionaryName}`}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    if (
                      hasMore &&
                      el.scrollHeight - el.scrollTop - el.clientHeight < 100
                    )
                      loadMore();
                  }}
                >
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-[var(--ui-color-slate-100)]">
                      <tr>
                        {data.columns.map((column) => (
                          <th
                            key={column.id}
                            className="border-b px-3 py-2 text-left font-medium"
                          >
                            {column.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, index) => (
                        <tr key={index}>
                          {row.map((value, column) => (
                            <td
                              key={column}
                              className="border-b px-3 py-2 align-top"
                            >
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isLoadingMore && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Загрузка...
                  </p>
                )}
                {data.totalCount === 0 && (
                  <p className="py-5 text-sm text-gray-500">Нет записей</p>
                )}
                {loadMoreError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    Не удалось загрузить следующие записи.{' '}
                    <button
                      type="button"
                      onClick={loadMore}
                      className="vismuth-function-button"
                    >
                      Повторить
                    </button>
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onClose}
              className="vismuth-button vismuth-button--secondary w-full"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
