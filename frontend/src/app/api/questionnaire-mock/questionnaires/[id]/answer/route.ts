import { NextResponse } from 'next/server';
import { errorResponse, isMockEnabled, notFound } from '../../../_mock/guard';
import { SLOW_ANSWER_MS } from '../../../_mock/mode';
import { loadForToken, mockEnv } from '../../../_mock/env';
import { applyAnswer } from '../../../_mock/flow';
import { saveQuestionnaire } from '../../../_mock/store';
import type { QuestionnaireStepAnswer } from '@/api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Предел длины `value` в схеме backend: длиннее — 422 ещё до сценария. */
const VALUE_MAX_LENGTH = 5000;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ответ на текущий шаг — `post_answer` backend: следующий шаг в ответ,
 * 409 на чужой `step_key`, 400 на неверный ответ.
 */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const { id } = await params;
  const loaded = loadForToken(request, id);
  if (!loaded.ok) return errorResponse(loaded.error);

  const body = (await request.json().catch(() => null)) as
    | (QuestionnaireStepAnswer & { skip?: boolean })
    | null;
  if (!body || typeof body.step_key !== 'string') {
    return errorResponse({
      status: 422,
      detail: [{ loc: ['body', 'step_key'], msg: 'Field required' }],
    });
  }
  if (typeof body.value === 'string' && body.value.length > VALUE_MAX_LENGTH) {
    return errorResponse({
      status: 422,
      detail: [
        {
          loc: ['body', 'value'],
          msg: `String should have at most ${VALUE_MAX_LENGTH} characters`,
        },
      ],
    });
  }

  const questionnaire = loaded.value;

  // Режим slow: ответ приходит с задержкой — видно ожидание в чате.
  if (questionnaire.mode === 'slow') {
    await delay(SLOW_ANSWER_MS);
  }

  const result = applyAnswer(questionnaire, body, mockEnv(questionnaire.mode));
  if (!result.ok) return errorResponse(result.error);

  saveQuestionnaire({ ...questionnaire, ...result.value.questionnaire });

  return NextResponse.json(result.value.step);
}
