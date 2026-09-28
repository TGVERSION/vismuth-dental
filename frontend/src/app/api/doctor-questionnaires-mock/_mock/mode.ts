// Режимы заглушки — чтобы проверить в браузере состояния, которых не
// дождёшься от настоящего сервера:
//
//   ok           — как текущий backend (по умолчанию): в списке нет
//                  `processing_status`, необработанные анкеты видны;
//   status_field — как backend после ВЗ-6 (вариант «поле в списке»):
//                  `processing_status` есть, фронтенд скрывает необработанные;
//   forbidden    — 403: пользователь не врач клиники;
//   error        — 500 на любой запрос;
//   slow         — ответ через 3 с: видно загрузку и отмену устаревших
//                  запросов.
//
// Режим берётся из файла во временном каталоге — его можно менять без
// перезапуска dev-сервера — либо из переменной
// DOCTOR_QUESTIONNAIRES_MOCK_MODE. Файл важнее.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forbidden, serverError } from './guard';

export type MockMode = 'ok' | 'status_field' | 'forbidden' | 'error' | 'slow';

const MODES: readonly MockMode[] = [
  'ok',
  'status_field',
  'forbidden',
  'error',
  'slow',
];

export const MODE_FILE = join(
  tmpdir(),
  'vismuth-doctor-questionnaires-mock-mode.txt',
);

const SLOW_RESPONSE_MS = 3000;

const readModeFile = (): string => {
  try {
    return readFileSync(MODE_FILE, 'utf8').trim();
  } catch {
    return '';
  }
};

export const currentMockMode = (): MockMode => {
  const raw =
    readModeFile() ||
    process.env.DOCTOR_QUESTIONNAIRES_MOCK_MODE?.trim() ||
    'ok';
  return (MODES as readonly string[]).includes(raw) ? (raw as MockMode) : 'ok';
};

/**
 * Общая реакция на режим: ответ-ошибка для `forbidden` и `error`, задержка
 * для `slow`. `null` — обрабатывать запрос дальше.
 */
export const applyMockMode = async (mode: MockMode) => {
  if (mode === 'forbidden') return forbidden();
  if (mode === 'error') return serverError();
  if (mode === 'slow') {
    await new Promise((resolve) => setTimeout(resolve, SLOW_RESPONSE_MS));
  }
  return null;
};
