'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TableEditor, Column } from './TableEditor';
import Image from 'next/image';
import { mainApi } from '@/api';
import type { DictionaryNames } from '@/api';

const LIMIT = 100;

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col-default-1', name: 'Колонка 1', width: 150 },
  { id: 'col-default-2', name: 'Колонка 2', width: 150 },
  { id: 'col-default-3', name: 'Колонка 3', width: 150 },
];

const DEFAULT_ROWS: string[][] = [
  ['', '', ''],
  ['', '', ''],
];

interface ModalData {
  dictionaryName: string;
  columns: Column[];
  rows: string[][];
  totalCount: number | null;
  loadedCount: number;
  isLoadError: boolean;
}

const makeInitialData = (dictionary?: DictionaryNames | null): ModalData => ({
  dictionaryName: dictionary?.name ?? '',
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_ROWS,
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
  const [data, setData] = useState<ModalData>(() => makeInitialData(dictionary));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const keysRef = useRef<string[]>([]);

  const isLoading = !!dictionary && data.totalCount === null && !data.isLoadError;

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
        const columns = keys.map((key, idx) => ({ id: `col-${idx}`, name: key, width: 150 }));
        const rows = res.items.map((item) => keys.map((key) => String(item[key] ?? '')));

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

    return () => { cancelled = true; };
  }, [dictionary]);

  const loadMore = useCallback(() => {
    if (!dictionary || isLoadingMore || isLoading) return;
    if (data.totalCount !== null && data.loadedCount >= data.totalCount) return;

    setIsLoadingMore(true);
    mainApi.dictionary
      .getDictionaryRef(dictionary.name, { limit: LIMIT, offset: data.loadedCount })
      .then((res) => {
        const keys = keysRef.current;
        if (!keys.length) return;
        const newRows = res.items.map((item) => keys.map((key) => String(item[key] ?? '')));
        setData((prev) => ({
          ...prev,
          rows: [...prev.rows, ...newRows],
          loadedCount: prev.loadedCount + newRows.length,
        }));
      })
      .catch(() => {/* ignore */})
      .finally(() => setIsLoadingMore(false));
  }, [dictionary, isLoadingMore, isLoading, data.totalCount, data.loadedCount]);

  const handleSave = useCallback(() => {
    console.log('Сохранённые данные:', {
      dictionaryName: data.dictionaryName,
      columns: data.columns,
      rows: data.rows,
    });
  }, [data]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  const hasMore = data.totalCount !== null && data.loadedCount < data.totalCount;

  return (
    <div
      onClick={handleOverlayClick}
      className="modal-overlay fixed inset-0 bg-black/50 flex justify-center items-start pt-10 z-1002 overflow-y-auto"
    >
      <div className="bg-white rounded-xl w-160 h-auto pr-5 pt-5 pb-10 pl-10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-fade-in">
        <div className="flex justify-end">
          <button onClick={onClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={20} height={20} />
          </button>
        </div>
        <div className="mr-5">
          <h2 className="text-[32px] font-medium text-[#202020] mb-7.5">
            {dictionary ? 'Редактирование справочника' : 'Новый справочник'}
          </h2>

          <label className="block text-[14px] text-[#6C757D] mb-1.25">
            Название справочника
          </label>
          <input
            type="text"
            value={data.dictionaryName}
            onChange={(e) => setData((prev) => ({ ...prev, dictionaryName: e.target.value }))}
            placeholder="Введите название"
            readOnly={!!dictionary}
            className={`w-full border-0 h-10 rounded-lg px-3 py-2 text-sm text-[#202020] bg-[#F2F4F7] outline-none mb-4 transition-colors ${
              dictionary ? 'opacity-60 cursor-default' : 'focus:border-[#5D8CF1]'
            }`}
          />

          {data.totalCount !== null && (
            <p className="text-xs text-[#6C757D] mb-3">
              Показано{' '}
              <span className="text-[#5D8CF1]">{data.loadedCount.toLocaleString('ru-RU')}</span>
              {' '}из{' '}
              <span className="text-[#5D8CF1]">{data.totalCount.toLocaleString('ru-RU')}</span>
            </p>
          )}

          <div className="mb-5">
            {isLoading ? (
              <p className="text-sm text-gray-400 py-8 text-center">Загрузка данных...</p>
            ) : data.isLoadError ? (
              <p className="text-sm text-red-400 py-8 text-center">Не удалось загрузить данные</p>
            ) : (
              <>
                <TableEditor
                  columns={data.columns}
                  rows={data.rows}
                  onColumnsChange={(columns) => setData((prev) => ({ ...prev, columns }))}
                  onRowsChange={(rows) => setData((prev) => ({ ...prev, rows }))}
                  onScrollNearBottom={hasMore ? loadMore : undefined}
                />
                {isLoadingMore && (
                  <p className="text-xs text-gray-400 text-center mt-2">Загрузка...</p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="cursor-pointer h-12 w-full py-3 bg-[#5D8CF1] hover:bg-[#769CEF] text-white rounded-xl transition-colors"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer h-12 w-full py-3 bg-[#DCE7FF] hover:bg-[#F0F5FF] rounded-xl transition-colors"
            >
              Отменить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
