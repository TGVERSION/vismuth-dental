// Окружение маршрутов заглушки: врачи и «ИИ» по режиму, доступ по токену.

import { activeDoctors } from './doctors';
import type { MockFlowEnv, MockResult } from './flow';
import type { MockMode } from './mode';
import {
  getQuestionnaire,
  issueCode,
  type StoredMockQuestionnaire,
} from './store';

export const mockEnv = (mode: MockMode): MockFlowEnv => ({
  doctors: activeDoctors(mode === 'doctor_inactive'),
  today: new Date(),
  aiDown: mode === 'ai_down',
  issueCode,
});

/**
 * Анкета по `id` и заголовку `X-Questionnaire-Token` — порядок проверок и
 * коды как в `_load_questionnaire_for_token` backend.
 */
export const loadForToken = (
  request: Request,
  id: string,
): MockResult<StoredMockQuestionnaire> => {
  const token = request.headers.get('x-questionnaire-token');
  if (!token) {
    return {
      ok: false,
      error: { status: 401, detail: 'X-Questionnaire-Token required' },
    };
  }

  const questionnaire = getQuestionnaire(id);
  if (!questionnaire) {
    return {
      ok: false,
      error: { status: 404, detail: 'Questionnaire not found' },
    };
  }
  if (questionnaire.token !== token) {
    return {
      ok: false,
      error: { status: 401, detail: 'Invalid questionnaire token' },
    };
  }

  return { ok: true, value: questionnaire };
};
