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
      <div className="flex items-start justify-between px-6.25 pt-5">
        <h3 className="text-xl font-medium text-[#202020]">
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
          className="flex flex-wrap gap-2 px-6.25 pt-4"
        >
          {items.map((item, index) => {
            const isSelected = item.sessionId === selected?.sessionId;
            const isFailed = item.status === 'error';
            const stateClass = isSelected
              ? isFailed
                ? 'bg-[#D91528] text-white'
                : 'bg-[#5D8CF1] text-white'
              : isFailed
                ? 'bg-[#FFF0F0] text-[#D91528] hover:bg-[#FFDCDC]'
                : 'bg-[#F0F5FF] text-[#202020] hover:bg-[#DCE7FF]';

            return (
              <button
                key={item.sessionId}
                type="button"
                onClick={() => onSelect(item.sessionId)}
                aria-pressed={isSelected}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[14px] transition-colors ${stateClass}`}
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
            <p className="text-[#909090] text-md">Загружаем расшифровку…</p>
          </div>
        ) : failed && items.length === 0 ? (
          <div className="text-center pt-9 px-6.25">
            <p className="text-[#D91528]">
              Не удалось загрузить расшифровку. Попробуйте открыть панель ещё
              раз.
            </p>
          </div>
        ) : !selected ? (
          <div className="text-center pt-9 px-6.25">
            <p className="text-[#909090] text-md">
              Для этого протокола ещё нет записей приёма.
            </p>
          </div>
        ) : (
          <div className="py-5 px-6.25">
            {items.length === 1 && (
              <p className="pb-3 text-[13px] text-[#6C757D]">
                {formatTranscriptLabel(selectedIndex, selected.createdAt)}
                {selected.status === 'error' && ' · не распознана'}
              </p>
            )}

            {selected.status === 'error' ? (
              <div className="rounded-xl border border-[#D91528] bg-[#FFF5F5] px-4 py-3">
                <p className="text-md text-[#D91528]">
                  {describeRecognitionFailure(selected.error)}
                </p>
                <p className="pt-2 text-[14px] text-[#6C757D]">
                  Текст из этой записи в протокол не попал. Заполните разделы
                  вручную или запишите приём заново.
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-md leading-[150%] text-[#202020]">
                {selected.transcript}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};
