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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px 28px 24px',
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            border: 'none',
            background: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: '#909090',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* Title */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#202020',
            marginBottom: 20,
          }}
        >
          Редактирование справочника
        </h2>

        {/* Name input */}
        <label
          style={{
            display: 'block',
            fontSize: 13,
            color: '#909090',
            marginBottom: 6,
          }}
        >
          Название справочника
        </label>
        <input
          type="text"
          value={dictionaryName}
          onChange={(e) => setDictionaryName(e.target.value)}
          placeholder="Введите название"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 14,
            color: '#202020',
            background: '#FAFAFA',
            outline: 'none',
            marginBottom: 20,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#5D8CF1')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
        />

        {/* Table editor */}
        <div style={{ marginBottom: 20 }}>
          <TableEditor
            columns={columns}
            rows={rows}
            onColumnsChange={setColumns}
            onRowsChange={setRows}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: '100%',
              padding: 12,
              background: '#5D8CF1',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = '#769CEF')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = '#5D8CF1')
            }
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: 12,
              background: '#EEF2FF',
              color: '#5D8CF1',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
}
