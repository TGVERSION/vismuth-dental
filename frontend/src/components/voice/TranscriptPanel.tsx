'use client';

import Image from 'next/image';
import {
  formatTranscriptLabel,
  resolveSelectedTranscript,
  type TranscriptItem,
} from '@/lib/transcripts';
import { describeRecognitionFailure } from '@/lib/transcription-errors';

interface TranscriptPanelProps {
  items: TranscriptItem[];
  isLoading: boolean;
  failed: boolean;
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}

/**
 * Содержимое правой панели с расшифровкой приёма.
 *
 * Внешний контейнер, ширина и перетаскиваемый разделитель — общие с панелью
 * клинических рекомендаций и живут на экране протокола: две панели не
 * открываются одновременно и делят одно место.
 *
 * Расшифровка — медицинский текст с сервера: рендерится React-ом, без
 * `innerHTML`, и никуда не логируется.
 */
export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  items,
  isLoading,
  failed,
  selectedId,
  onSelect,
  onClose,
}) => {
  const selected = resolveSelectedTranscript(items, selectedId);
  const selectedIndex = selected
    ? items.findIndex((item) => item.sessionId === selected.sessionId)
    : -1;

  return (
    <>
      <div className="flex items-start justify-between px-[var(--ui-space-24)] pt-5">
        <h3 className="text-xl font-medium text-[var(--ui-color-alabaster-dark-800)]">
          Расшифровка приёма
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть расшифровку"
          className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Image alt="" src="/close.svg" width={25} height={25} />
        </button>
      </div>

      {/* Переключатель нужен только когда записей больше одной. */}
      {items.length > 1 && (
        <div
          role="group"
          aria-label="Записи приёма"
          className="flex flex-wrap gap-2 px-[var(--ui-space-24)] pt-4"
        >
          {items.map((item, index) => {
            const isSelected = item.sessionId === selected?.sessionId;
            const isFailed = item.status === 'error';
            const stateClass = isSelected
              ? isFailed
                ? 'bg-[var(--ui-color-red-600)] text-white'
                : 'bg-[var(--ui-color-blue-600)] text-white'
              : isFailed
                ? 'bg-[var(--ui-color-red-50)] text-[var(--ui-color-red-600)] hover:bg-[var(--ui-color-red-100)]'
                : 'bg-[var(--ui-color-blue-50)] text-[var(--ui-color-alabaster-dark-800)] hover:bg-[var(--ui-color-blue-100)]';

            return (
              <button
                key={item.sessionId}
                type="button"
                onClick={() => onSelect(item.sessionId)}
                aria-pressed={isSelected}
                className={`cursor-pointer rounded-lg px-3 py-[var(--ui-space-6)] text-[length:var(--ui-font-size-14)] transition-colors ${stateClass}`}
              >
                {formatTranscriptLabel(index, item.createdAt)}
                {isFailed && ' · не распознана'}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading && items.length === 0 ? (
          <div className="text-center pt-9">
            <p className="text-[var(--ui-color-alabaster-950)] text-md">
              Загружаем расшифровку…
            </p>
          </div>
        ) : failed && items.length === 0 ? (
          <div className="text-center pt-9 px-[var(--ui-space-24)]">
            <p className="text-[var(--ui-color-red-600)]">
              Не удалось загрузить расшифровку. Попробуйте открыть панель ещё
              раз.
            </p>
          </div>
        ) : !selected ? (
          <div className="text-center pt-9 px-[var(--ui-space-24)]">
            <p className="text-[var(--ui-color-alabaster-950)] text-md">
              Для этого протокола ещё нет записей приёма.
            </p>
          </div>
        ) : (
          <div className="py-5 px-[var(--ui-space-24)]">
            {items.length === 1 && (
              <p className="pb-3 text-[length:var(--ui-font-size-13)] text-[var(--ui-color-alabaster-950)]">
                {formatTranscriptLabel(selectedIndex, selected.createdAt)}
                {selected.status === 'error' && ' · не распознана'}
              </p>
            )}

            {selected.status === 'error' ? (
              <div className="rounded-xl border border-[var(--ui-color-red-600)] bg-[var(--ui-color-red-50)] px-4 py-3">
                <p className="text-md text-[var(--ui-color-red-600)]">
                  {describeRecognitionFailure(selected.error)}
                </p>
                <p className="pt-2 text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-950)]">
                  Текст из этой записи в протокол не попал. Заполните разделы
                  вручную или запишите приём заново.
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-md text-[var(--ui-color-alabaster-dark-800)]">
                {selected.transcript}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};
