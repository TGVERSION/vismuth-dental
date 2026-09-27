import { NextResponse } from 'next/server';
import { badRequest, isMockEnabled, notFound } from '../../../_mock/guard';
import { getSession, issueCode } from '../../../_mock/store';
import type { QuestionnaireCompleteResponse } from '@/api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Завершение анкеты: данные приёма в обмен на код из 4 цифр. */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const { id } = await params;
  const session = getSession(id);
  if (!session) return notFound();

  const body = (await request.json().catch(() => null)) as {
    first_name?: string;
    appointment_date?: string;
    appointment_time?: string;
  } | null;

  if (!body?.first_name?.trim()) return badRequest('first_name is required');
  if (!body?.appointment_date)
    return badRequest('appointment_date is required');
  if (!body?.appointment_time)
    return badRequest('appointment_time is required');

  // Код выдаётся один раз: повторный запрос вернёт тот же, а не новый.
  const payload: QuestionnaireCompleteResponse = { code: issueCode(session) };

  return NextResponse.json(payload);
}
