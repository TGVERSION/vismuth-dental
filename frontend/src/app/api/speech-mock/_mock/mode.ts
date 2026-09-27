// Режимы сбоя заглушки — чтобы проверить в браузере, как фронтенд сообщает
// о проблемах распознавания, не дожидаясь, пока сломается настоящий сервис.
//
//   ok     — обычная работа (по умолчанию);
//   error  — обработка завершается статусом `error` с причиной;
//   lost   — сессия пропадает на сервере после завершения записи (404);
//   flaky  — сервис первые 20 секунд после завершения не отвечает на опрос
//            (503), затем отдаёт результат.
//
// Режим берётся из файла во временном каталоге — его можно менять без
// перезапуска dev-сервера — либо из переменной SPEECH_MOCK_MODE. Файл важнее.
// Режим фиксируется для сессии в момент завершения записи, поэтому смена
// режима не переписывает задним числом уже сделанные записи.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type MockMode = 'ok' | 'error' | 'lost' | 'flaky';

const MODES: readonly MockMode[] = ['ok', 'error', 'lost', 'flaky'];

export const MODE_FILE = join(tmpdir(), 'vismuth-speech-mock-mode.txt');

/** Сколько сервис «лежит» в режиме flaky. */
export const FLAKY_OUTAGE_MS = 20_000;

/** Причина сбоя в режиме error — явно помечена как демонстрационная. */
export const MOCK_ERROR_TEXT =
  'слишком тихая запись, речь не распознана (демо-сбой заглушки)';

const readModeFile = (): string => {
  try {
    return readFileSync(MODE_FILE, 'utf8').trim();
  } catch {
    return '';
  }
};

export const currentMockMode = (): MockMode => {
  const raw = readModeFile() || process.env.SPEECH_MOCK_MODE?.trim() || 'ok';
  return (MODES as readonly string[]).includes(raw) ? (raw as MockMode) : 'ok';
};
