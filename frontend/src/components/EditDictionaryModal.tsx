'use client';

import { useState, useCallback } from 'react';
import { TableEditor, Column } from './TableEditor';

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

export function EditDictionaryModal({ isOpen, onClose }: EditDictionaryModalProps) {
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
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    >
      <div className="relative bg-white rounded-xl w-[640px] max-h-[90vh] overflow-y-auto px-7 pt-7 pb-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 border-none bg-transparent text-lg leading-none cursor-pointer text-[#909090] hover:text-[#202020] transition-colors"
        >
          ✕
        </button>

        {/* Title */}
        <h2 className="text-xl font-semibold text-[#202020] mb-5">
          Редактирование справочника
        </h2>

        {/* Name input */}
        <label className="block text-[13px] text-[#909090] mb-1.5">
          Название справочника
        </label>
        <input
          type="text"
          value={dictionaryName}
          onChange={(e) => setDictionaryName(e.target.value)}
          placeholder="Введите название"
          className="w-full border border-[#E5E7EB] focus:border-[#5D8CF1] rounded-lg px-3.5 py-2.5 text-sm text-[#202020] bg-[#FAFAFA] outline-none mb-5 transition-colors"
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
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 bg-[#5D8CF1] hover:bg-[#769CEF] text-white border-none rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#5D8CF1] border-none rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
}
