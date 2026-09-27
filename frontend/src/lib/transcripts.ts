// Список записей приёма для просмотра в боковой панели.
//
// У протокола может быть несколько записей: приём прервали и начали заново,
// дописали что-то после основной консультации. Врачу нужно видеть их по
// отдельности, в порядке записи, и понимать, какая из них какая — в том числе
// какая не распозналась.

import type { SpeechSessionStatus } from '@/api';

export interface TranscriptItem {
  sessionId: string;
  createdAt: string | null;
  /** `error` — распознавание не удалось, текста нет, есть причина. */
  status: 'done' | 'error';
  transcript: string | null;
  error: string | null;
}

const toTime = (value: string | null): number => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Записи для панели, от старой к новой: готовые с непустой расшифровкой и
 * упавшие при распознавании.
 *
 * Упавшие показываются намеренно — иначе приём, который не попал в протокол,
 * исчезал бы бесследно. Незавершённые и брошенные записи в список не попадают:
 * смотреть в них нечего. Записи без времени считаются самыми старыми — так
 * они не вклиниваются между датированными.
 */
export const selectTranscriptItems = (
  sessions: SpeechSessionStatus[],
): TranscriptItem[] =>
  sessions
    .filter(
      (session) =>
        (session.status === 'done' &&
          typeof session.transcript === 'string' &&
          session.transcript.trim().length > 0) ||
        session.status === 'error',
    )
    .map((session) => ({
      sessionId: session.session_id,
      createdAt: session.created_at,
      status: session.status as TranscriptItem['status'],
      transcript: session.transcript,
      error: session.error,
    }))
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));

/**
 * Подпись записи для переключателя: «Запись 2 · 14:05».
 * Если время неизвестно, остаётся только номер — порядок всё равно понятен.
 */
export const formatTranscriptLabel = (
  index: number,
  createdAt: string | null,
): string => {
  const base = `Запись ${index + 1}`;
  const time = toTime(createdAt);
  if (!time) return base;

  const clock = new Date(time).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${base} · ${clock}`;
};

/**
 * Какую запись показать. Выбранная ранее сохраняется, пока она есть в списке;
 * иначе показывается последняя — как правило, врач открывает панель ради
 * только что закончившегося приёма.
 */
export const resolveSelectedTranscript = (
  items: TranscriptItem[],
  selectedId: string | null,
): TranscriptItem | null => {
  if (items.length === 0) return null;
  return (
    items.find((item) => item.sessionId === selectedId) ??
    items[items.length - 1]
  );
};
