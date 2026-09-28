// Режимы сбоя заглушки — чтобы проверить в браузере, как анкета ведёт себя
// при недоступном ИИ, закрытой подписке и сработавших лимитах, не дожидаясь,
// пока это случится на настоящем сервере. Коды — те же, что у backend.
//
//   ok                   — обычная работа (по умолчанию);
//   ai_down              — ИИ недоступен: уточняющих вопросов нет, на шаге
//                          кода выставлен `ai_unavailable`;
//   slow                 — ответ на шаг приходит с задержкой: видно
//                          ожидание, «Назад» в чате неактивна;
//   subscription_expired — подписка клиники завершена: ссылка заблокирована,
//                          старт — 503;
//   clinic_daily_limit   — суточный лимит анкет клиники: то же;
//   doctor_inactive      — врач ссылки врача не ведёт приём: ссылка врача
//                          заблокирована, старт по ней — 400;
//   device_limit         — лимит анкет с устройства: старт — 429;
//   ip_limit             — лимит анкет с адреса: старт — 429.
//
// Режим берётся из файла во временном каталоге — его можно менять без
// перезапуска dev-сервера — либо из переменной QUESTIONNAIRE_MOCK_MODE.
// Файл важнее.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type MockMode =
  | 'ok'
  | 'ai_down'
  | 'slow'
  | 'subscription_expired'
  | 'clinic_daily_limit'
  | 'doctor_inactive'
  | 'device_limit'
  | 'ip_limit';

const MODES: readonly MockMode[] = [
  'ok',
  'ai_down',
  'slow',
  'subscription_expired',
  'clinic_daily_limit',
  'doctor_inactive',
  'device_limit',
  'ip_limit',
];

export const MODE_FILE = join(tmpdir(), 'vismuth-questionnaire-mock-mode.txt');

/** Насколько задерживается ответ на шаг в режиме slow. */
export const SLOW_ANSWER_MS = 3_000;

const readModeFile = (): string => {
  try {
    return readFileSync(MODE_FILE, 'utf8').trim();
  } catch {
    return '';
  }
};

export const currentMockMode = (): MockMode => {
  const raw =
    readModeFile() || process.env.QUESTIONNAIRE_MOCK_MODE?.trim() || 'ok';
  return (MODES as readonly string[]).includes(raw) ? (raw as MockMode) : 'ok';
};
