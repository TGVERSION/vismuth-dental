import { NextResponse } from 'next/server';
import { badRequest, isMockEnabled, notFound } from '../_mock/guard';
import { createSession } from '../_mock/store';
import { VISIT_TYPE_STEP, makeMessage } from '../_mock/script';
import type { QuestionnaireSession } from '@/api';

/**
 * Старт анкеты. Сессия создаётся в момент нажатия «Да, рассказать»: по ней
 * настоящий сервер будет считать брошенные анкеты по последнему пройденному
 * шагу.
 */
export async function POST(request: Request) {
  if (!isMockEnabled) return notFound();

  const body = (await request.json().catch(() => null)) as {
    link_code?: string;
    doctor_id?: string;
  } | null;

  if (!body?.link_code) return badRequest('link_code is required');
  if (!body?.doctor_id) return badRequest('doctor_id is required');

  const session = createSession(body.link_code, body.doctor_id);

  const payload: QuestionnaireSession = {
    session_id: session.sessionId,
    message: makeMessage({
      ...VISIT_TYPE_STEP,
      finished: false,
      ai_unavailable: session.mode === 'ai_down',
      progress: 0,
    }),
  };

  return NextResponse.json(payload);
}
