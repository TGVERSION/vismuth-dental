// Параметры записи приёма и вспомогательные расчёты.
//
// Записывается вся консультация целиком, поэтому величины здесь выбраны не
// «на глаз», а из ограничений сценария:
//
// - запись нарезается на фрагменты и уходит на сервер по ходу приёма. Один
//   blob на сорок минут означал бы потерю всей консультации при закрытии
//   вкладки, а приём переиграть нельзя;
// - речь пишется в моно с низким битрейтом: сорокаминутный приём при 32 кбит/с
//   весит около 9 МБ, на дефолтных настройках браузера — кратно больше.
//
// Значения стартовые: их нужно уточнить замерами на реальном стенде и по
// лимитам, которые задаст backend.

/** Длина одного фрагмента записи, мс. Передаётся в `MediaRecorder.start()`. */
export const CHUNK_TIMESLICE_MS = 15_000;

/** Битрейт аудио: речь в моно. */
export const AUDIO_BITS_PER_SECOND = 32_000;

/**
 * Предельная длительность одной сессии записи, мс.
 * Запасное значение до того, как backend назовёт свой лимит.
 */
export const MAX_SESSION_MS = 60 * 60 * 1000;

/**
 * Типы контейнера в порядке предпочтения. Chrome и Edge пишут webm/opus,
 * Safari — mp4; фактический тип передаётся на сервер вместе с фрагментом,
 * потому что декодировать придётся именно его.
 */
export const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;

/**
 * Первый поддерживаемый браузером тип записи или `null`, если не поддержан
 * ни один — тогда запись недоступна и кнопку показывать нельзя.
 *
 * Предикат передаётся аргументом, чтобы функция проверялась тестами без
 * `MediaRecorder`, которого нет в node-окружении vitest.
 */
export const pickRecorderMimeType = (
  isSupported: (mimeType: string) => boolean,
): string | null =>
  RECORDER_MIME_CANDIDATES.find((mimeType) => isSupported(mimeType)) ?? null;

/**
 * Расширение файла для фрагмента записи. Нужно только для читаемых имён
 * на сервере: формат сервер берёт из отдельного поля `mime`, а не из имени.
 */
export const fileExtensionForMime = (mimeType: string): string => {
  const base = mimeType.split(';')[0].trim().toLowerCase();

  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/mp4') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';

  return 'bin';
};

/**
 * Длительность в виде `MM:SS`, а после часа — `H:MM:SS`.
 * Отрицательные и нечисловые значения дают `00:00`: таймер на экране врача
 * не должен показывать мусор, даже если часы системы прыгнули назад.
 */
export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * Оценка объёма записи по её длительности. Нужна, чтобы предупредить врача
 * о накопленном объёме, не дожидаясь отказа сервера по размеру.
 */
export const estimateBytes = (
  ms: number,
  bitsPerSecond: number = AUDIO_BITS_PER_SECOND,
): number => {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / 1000) * (bitsPerSecond / 8));
};
