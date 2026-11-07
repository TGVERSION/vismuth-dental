'use client';

import Image from 'next/image';
import { formatDuration } from '@/lib/voice-recording';
import type { RecorderState } from '@/hooks/useVisitRecorder';

interface VisitRecorderButtonProps {
  state: RecorderState;
  durationMs: number;
  pendingChunks: number;
  disabledReason: string | null;
  isProcessing: boolean;
  /** Обработка идёт, но сервер несколько раз подряд не ответил на опрос. */
  isConnectionLost: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const BUTTON_CLASS = 'vismuth-button';

/** Кнопка записи приёма в тулбаре протокола. */
export const VisitRecorderButton: React.FC<VisitRecorderButtonProps> = ({
  state,
  durationMs,
  pendingChunks,
  disabledReason,
  isProcessing,
  isConnectionLost,
  onStart,
  onStop,
  onPause,
  onResume,
  onCancel,
}) => {
  // Микрофон недоступен: HTTP-стенд или браузер без MediaRecorder. Молча
  // прятать нельзя — врач должен понимать, почему функции нет.
  if (state === 'unsupported') {
    return (
      <span
        className="text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-950)]"
        title="Нужен HTTPS или localhost"
      >
        Запись приёма недоступна в этом браузере
      </span>
    );
  }

  if (isProcessing) {
    // Сервер перестал отвечать: ждать продолжаем, но врач должен видеть, что
    // спиннер крутится не просто так долго, а из-за связи.
    return isConnectionLost ? (
      <span
        role="status"
        className="flex items-center gap-2 py-3 px-[var(--ui-space-14)] text-[length:var(--ui-font-size-14)] text-[var(--ui-color-yellow-600)]"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-[var(--ui-color-yellow-600)]" />
        Нет связи с сервером, продолжаем ждать…
      </span>
    ) : (
      <span
        role="status"
        className="flex items-center gap-2 py-3 px-[var(--ui-space-14)] text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-950)]"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-[var(--ui-color-blue-600)]" />
        Расшифровываем приём…
      </span>
    );
  }

  const isRecording = state === 'recording' || state === 'paused';

  if (!isRecording && state !== 'finishing') {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={!!disabledReason || state === 'starting'}
        title={
          disabledReason ?? 'Записать приём и заполнить протокол по расшифровке'
        }
        className={BUTTON_CLASS}
        data-variant="secondary"
      >
        <Image alt="" src="/mic.svg" width={20} height={20} />
        {state === 'starting' ? 'Подготовка…' : 'Записать приём'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onStop}
        disabled={state === 'finishing'}
        className={BUTTON_CLASS}
        data-variant="secondary"
      >
        <Image alt="" src="/mic-stop.svg" width={20} height={20} />
        {state === 'finishing'
          ? 'Завершаем…'
          : `Остановить · ${formatDuration(durationMs)}`}
      </button>

      {state !== 'finishing' && (
        <>
          <button
            type="button"
            onClick={state === 'paused' ? onResume : onPause}
            className="vismuth-function-button cursor-pointer text-[length:var(--ui-font-size-14)] text-[var(--ui-color-blue-600)] hover:underline"
          >
            {state === 'paused' ? 'Продолжить' : 'Пауза'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-950)] hover:underline"
            title="Прервать запись и удалить её"
          >
            Отменить
          </button>
        </>
      )}

      {pendingChunks > 0 && (
        <span className="text-[length:var(--ui-font-size-13)] text-[var(--ui-color-yellow-600)]">
          не отправлено фрагментов: {pendingChunks}
        </span>
      )}
    </div>
  );
};
