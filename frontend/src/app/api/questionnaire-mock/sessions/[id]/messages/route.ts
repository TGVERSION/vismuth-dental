import { NextResponse } from 'next/server';
import { badRequest, isMockEnabled, notFound } from '../../../_mock/guard';
import { SLOW_ANSWER_MS } from '../../../_mock/mode';
import { getSession, saveSession } from '../../../_mock/store';
import {
  CLARIFICATION_LIMIT,
  FINAL_MESSAGE_TEXT,
  clarificationText,
  makeMessage,
  progressFor,
  stepsForVisitType,
  totalQuestions,
  visitTypeFromAnswer,
} from '../../../_mock/script';
import type { QuestionnaireMessage } from '@/api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ответ пациента и следующий вопрос ассистента.
 *
 * Лимит уточняющих (6 для первичного приёма, 2 для повторного) держится
 * здесь, на сервере, а не в подсказке модели: фронтенд его не эмулирует и
 * просто показывает то, что пришло.
 */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const { id } = await params;
  const session = getSession(id);
  if (!session) return notFound();

  const body = (await request.json().catch(() => null)) as {
    text?: string;
  } | null;

  if (typeof body?.text !== 'string') {
    return badRequest('text is required');
  }

  if (session.finished) {
    return badRequest('session is already finished');
  }

  // Режим slow: ассистент отвечает долго — видно подписи ожидания в чате.
  if (session.mode === 'slow') {
    await delay(SLOW_ANSWER_MS);
  }

  const aiUnavailable = session.mode === 'ai_down';
  session.answers += 1;

  // Первый ответ задаёт ветку сценария: первичный приём или повторный.
  if (session.visitType === null) {
    session.visitType = visitTypeFromAnswer(body.text ?? '');
    session.stepIndex = 0;
    session.clarificationsAsked = 0;
    saveSession(session);

    const first = stepsForVisitType(session.visitType)[0];
    return NextResponse.json(
      makeMessage({
        ...first,
        finished: false,
        ai_unavailable: aiUnavailable,
        progress: progressFor(
          session.answers,
          totalQuestions(session.visitType, !aiUnavailable),
        ),
      }),
    );
  }

  const steps = stepsForVisitType(session.visitType);
  const current = steps[session.stepIndex];
  const wantedClarifications = Math.min(
    current?.clarifications ?? 0,
    CLARIFICATION_LIMIT[session.visitType],
  );

  // Уточняющие вопросы ИИ. При недоступном ИИ их нет вовсе, но анкета
  // продолжается — ТЗ прямо требует, чтобы она в этом случае не ломалась.
  if (!aiUnavailable && session.clarificationsAsked < wantedClarifications) {
    const index = session.clarificationsAsked;
    session.clarificationsAsked += 1;
    saveSession(session);

    return NextResponse.json(
      makeMessage({
        step: `clarify_${index + 1}`,
        text: clarificationText(index),
        quick_replies: null,
        input: 'text',
        finished: false,
        ai_unavailable: false,
        progress: progressFor(
          session.answers,
          totalQuestions(session.visitType, true),
        ),
      }),
    );
  }

  session.stepIndex += 1;
  session.clarificationsAsked = 0;

  if (session.stepIndex >= steps.length) {
    session.finished = true;
    saveSession(session);

    const final: QuestionnaireMessage = makeMessage({
      step: 'finished',
      text: FINAL_MESSAGE_TEXT,
      quick_replies: null,
      input: 'none',
      finished: true,
      ai_unavailable: aiUnavailable,
      progress: 1,
    });
    return NextResponse.json(final);
  }

  saveSession(session);

  return NextResponse.json(
    makeMessage({
      ...steps[session.stepIndex],
      finished: false,
      ai_unavailable: aiUnavailable,
      progress: progressFor(
        session.answers,
        totalQuestions(session.visitType, !aiUnavailable),
      ),
    }),
  );
}
