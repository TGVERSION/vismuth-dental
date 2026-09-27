// Режимы сбоя заглушки — чтобы проверить в браузере, как анкета ведёт себя
// при недоступном ИИ, закрытой подписке и сработавших лимитах, не дожидаясь,
// пока это случится на настоящем сервере.
//
//   ok                 — обычная работа (по умолчанию);
//   ai_down            — ИИ недоступен: уточняющих вопросов нет, у сообщений
//                        выставлен `ai_unavailable`, анкета доходит до конца;
//   slow               — ассистент отвечает долго: видно подписи ожидания;
//   subscription_ended — подписка клиники завершена;
//   doctor_inactive    — врач по ссылке не ведёт приём;
//   clinic_limit       — превышен суточный лимит анкет клиники;
//   device_limit       — превышен лимит с устройства;
//   ip_limit           — превышен лимит с адреса.
//
// Режим берётся из файла во временном каталоге — его можно менять без
// перезапуска dev-сервера — либо из переменной QUESTIONNAIRE_MOCK_MODE.
// Файл важнее.

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { QuestionnaireState } from '@/api';

export type MockMode =
  | 'ok'
  | 'ai_down'
  | 'slow'
  | 'subscription_ended'
  | 'doctor_inactive'
  | 'clinic_limit'
  | 'device_limit'
  | 'ip_limit';

const MODES: readonly MockMode[] = [
  'ok',
  'ai_down',
  'slow',
  'subscription_ended',
  'doctor_inactive',
  'clinic_limit',
  'device_limit',
  'ip_limit',
];

export const MODE_FILE = join(tmpdir(), 'vismuth-questionnaire-mock-mode.txt');

/** Насколько задерживается ответ ассистента в режиме slow. */
export const SLOW_ANSWER_MS = 20_000;

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

/**
 * Состояние ссылки для текущего режима. Режимы `ok`, `ai_down` и `slow`
 * касаются только диалога, сама ссылка при них рабочая.
 */
export const stateForMode = (mode: MockMode): QuestionnaireState => {
  switch (mode) {
    case 'subscription_ended':
    case 'doctor_inactive':
    case 'clinic_limit':
    case 'device_limit':
    case 'ip_limit':
      return mode;
    default:
      return 'ok';
  }
};
