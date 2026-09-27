// Сообщения о сбоях распознавания приёма и учёт уже показанных сбоев.
//
// Сбой распознавания — это потерянный для протокола приём: врач должен узнать
// о нём, даже если в момент сбоя смотрел в другой протокол. Но и повторять одно
// и то же уведомление при каждом открытии протокола нельзя. Поэтому
// идентификаторы показанных сбоев запоминаются локально. Хранятся только
// идентификаторы сессий: ни текста сервера, ни расшифровки там нет.

import type { SpeechSessionStatus } from '@/api';

const STORAGE_KEY = 'speech-acknowledged-failures';
/** Сколько последних показанных сбоев помнить: старые больше не всплывут. */
const MAX_REMEMBERED = 50;
/** Длинный текст сервера не должен растягивать уведомление на пол-экрана. */
const MAX_SERVER_ERROR_LENGTH = 200;

/** Текст причины от сервера, пригодный для показа, или `null`. */
export const shortenServerError = (
  serverError: string | null | undefined,
): string | null => {
  const detail = serverError?.trim();
  if (!detail) return null;
  if (detail.length <= MAX_SERVER_ERROR_LENGTH) return detail;
  return `${detail.slice(0, MAX_SERVER_ERROR_LENGTH).trimEnd()}…`;
};

/** Сообщение о сбое распознавания с причиной от сервера, если она есть. */
export const describeRecognitionFailure = (
  serverError: string | null | undefined,
): string => {
  const detail = shortenServerError(serverError);
  return detail
    ? `Расшифровка не выполнена: ${detail}`
    : 'Расшифровка не выполнена.';
};

/** Сбои, о которых врачу ещё не сообщали. */
export const pickUnreportedFailures = (
  sessions: SpeechSessionStatus[],
  acknowledged: string[],
): SpeechSessionStatus[] =>
  sessions.filter(
    (session) =>
      session.status === 'error' && !acknowledged.includes(session.session_id),
  );

/**
 * Сообщение о сбоях, случившихся, пока врач был на другом экране.
 * `null` — сообщать не о чем.
 */
export const describeMissedFailures = (
  failures: SpeechSessionStatus[],
): string | null => {
  if (failures.length === 0) return null;

  if (failures.length === 1) {
    const detail = shortenServerError(failures[0].error);
    return detail
      ? `Запись приёма не распознана: ${detail}`
      : 'Запись приёма не распознана.';
  }

  return `Не распознано записей приёма: ${failures.length}. Подробности — в панели «Расшифровка приёма».`;
};

/**
 * Добавить сбои к уже показанным: без повторов, новые — в конец, лишние
 * старые отбрасываются.
 */
export const rememberAcknowledged = (
  current: string[],
  ids: string[],
): string[] => {
  const fresh = [...new Set(ids)];
  const kept = current.filter((id) => !fresh.includes(id));
  return [...kept, ...fresh].slice(-MAX_REMEMBERED);
};

export const readAcknowledgedFailures = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    // Хранилище недоступно или повреждено: лучше показать уведомление ещё
    // раз, чем уронить экран протокола.
    return [];
  }
};

export const acknowledgeFailures = (ids: string[]): void => {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(rememberAcknowledged(readAcknowledgedFailures(), ids)),
    );
  } catch {
    // Не запомнили — уведомление всплывёт повторно, это безопасный исход.
  }
};
