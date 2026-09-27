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

const BUTTON_CLASS =
  'cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75 disabled:opacity-50 disabled:cursor-not-allowed';

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
        className="text-[14px] text-[#6C757D]"
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
        className="flex items-center gap-2 py-3 px-3.75 text-[14px] text-[#F29100]"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#F29100]" />
        Нет связи с сервером, продолжаем ждать…
      </span>
    ) : (
      <span
        role="status"
        className="flex items-center gap-2 py-3 px-3.75 text-[14px] text-[#6C757D]"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#5D8CF1]" />
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
            className="cursor-pointer text-[14px] text-[#5D8CF1] hover:underline"
          >
            {state === 'paused' ? 'Продолжить' : 'Пауза'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer text-[14px] text-[#6C757D] hover:underline"
            title="Прервать запись и удалить её"
          >
            Отменить
          </button>
        </>
      )}

      {pendingChunks > 0 && (
        <span className="text-[13px] text-[#F29100]">
          не отправлено фрагментов: {pendingChunks}
        </span>
      )}
    </div>
  );
};
