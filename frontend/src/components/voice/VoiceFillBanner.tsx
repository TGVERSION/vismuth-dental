'use client';

import type { VoiceFillEntry } from '@/lib/voice-fill';

interface VoiceFillBannerProps {
  entries: VoiceFillEntry[];
  /** Открыть панель расшифровки на записи, из которой заполнен протокол. */
  onShowTranscript: () => void;
  onRevertAll: () => void;
  onDismiss: () => void;
}

/**
 * Полоска над протоколом после того, как расшифровка разложена по полям.
 *
 * Сама расшифровка здесь не показывается: для неё есть правая панель, и
 * держать один и тот же текст в двух местах значило бы разводить их поведение.
 */
export const VoiceFillBanner: React.FC<VoiceFillBannerProps> = ({
  entries,
  onShowTranscript,
  onRevertAll,
  onDismiss,
}) => {
  if (entries.length === 0) return null;

  const appended = entries.filter((entry) => entry.mode === 'append').length;

  return (
    <div
      data-print-hide
      className="ml-6 mr-2 mb-2 rounded-xl border border-[#5D8CF1] bg-[#F0F5FF] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[14px] text-[#202020]">
          Протокол заполнен из записи приёма: полей — {entries.length}
          {appended > 0 && `, из них дописано к вашему тексту — ${appended}`}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onShowTranscript}
            className="cursor-pointer text-[14px] text-[#5D8CF1] hover:underline"
          >
            Показать расшифровку
          </button>
          <button
            type="button"
            onClick={onRevertAll}
            className="cursor-pointer text-[14px] text-[#D91528] hover:underline"
          >
            Отменить всё
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer text-[14px] text-[#6C757D] hover:underline"
            title="Убрать подсказку и оставить текст как есть"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
