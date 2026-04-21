'use client';

import { useState, useCallback } from 'react';
import { TableEditor, Column } from './TableEditor';
import Image from 'next/image';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

interface EditDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col-default-1', name: 'Колонка 1', width: 150 },
  { id: 'col-default-2', name: 'Колонка 2', width: 150 },
  { id: 'col-default-3', name: 'Колонка 3', width: 150 },
];

const DEFAULT_ROWS: string[][] = [
  ['', '', ''],
  ['', '', ''],
];

export function EditDictionaryModal({
  isOpen,
  onClose,
}: EditDictionaryModalProps) {
  useLockBodyScroll(isOpen);
  const [dictionaryName, setDictionaryName] = useState('');
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [rows, setRows] = useState<string[][]>(DEFAULT_ROWS);

  const handleSave = useCallback(() => {
    console.log('Сохранённые данные:', { dictionaryName, columns, rows });
  }, [dictionaryName, columns, rows]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      className="modal-overlay fixed inset-0 bg-black/50 flex justify-center items-start pt-10 z-[1002] overflow-y-auto "
    >
      <div className="bg-white rounded-xl w-160 h-auto pr-5 pt-5 pb-10 pl-10 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        {/* Close */}
        <div className="flex justify-end">
          <button onClick={onClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={20} height={20} />
          </button>
        </div>
        <div className="mr-5">
          {/* Title */}
          <h2 className="text-[32px] font-medium text-[#202020] mb-7.5">
            Редактирование справочника
          </h2>

          {/* Name input */}
          <label className="block text-[14px] text-[#6C757D] mb-1.25">
            Название справочника
          </label>
          <input
            type="text"
            value={dictionaryName}
            onChange={(e) => setDictionaryName(e.target.value)}
            placeholder="Введите название"
            className="w-full border-0 h-10 focus:border-[#5D8CF1] rounded-lg px-3 py-2 text-sm text-[#202020] bg-[#F2F4F7] outline-none mb-4 transition-colors"
          />

          {/* Table editor */}
          <div className="mb-5">
            <TableEditor
              columns={columns}
              rows={rows}
              onColumnsChange={setColumns}
              onRowsChange={setRows}
            />
          </div>

          {/* Actions */}
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
