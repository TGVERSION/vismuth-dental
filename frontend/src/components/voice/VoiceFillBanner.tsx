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
      className="ml-6 mr-2 mb-2 rounded-xl border border-[var(--ui-color-blue-600)] bg-[var(--ui-color-blue-50)] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-dark-800)]">
          Протокол заполнен из записи приёма: полей — {entries.length}
          {appended > 0 && `, из них дописано к вашему тексту — ${appended}`}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onShowTranscript}
            className="vismuth-function-button cursor-pointer text-[length:var(--ui-font-size-14)] text-[var(--ui-color-blue-600)] hover:underline"
          >
            Показать расшифровку
          </button>
          <button
            type="button"
            onClick={onRevertAll}
            className="cursor-pointer text-[length:var(--ui-font-size-14)] text-[var(--ui-color-red-600)] hover:underline"
          >
            Отменить всё
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-950)] hover:underline"
            title="Убрать подсказку и оставить текст как есть"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
