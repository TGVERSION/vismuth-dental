import { NextResponse } from 'next/server';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from '../../../_mock/guard';
import { addChunk, getSession } from '../../../_mock/store';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * Приём одного фрагмента записи.
 *
 * Обработка идемпотентна по `seq`: повторная отправка того же номера после
 * обрыва связи не должна удваивать фрагмент. Это же требование выставлено
 * настоящему backend во внешних зависимостях задачи.
 */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) return notFound();

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const seqRaw = form?.get('seq');

  if (!(file instanceof Blob) || typeof seqRaw !== 'string') {
    return NextResponse.json(
      { detail: 'file and seq are required' },
      { status: 422 },
    );
  }

  const seq = Number.parseInt(seqRaw, 10);
  if (!Number.isInteger(seq) || seq < 0) {
    return NextResponse.json(
      { detail: 'seq must be an integer' },
      { status: 422 },
    );
  }

  addChunk(sessionId, seq);

  return NextResponse.json(
    { session_id: session.sessionId, seq },
    { status: 202 },
  );
}
