import { NextResponse } from 'next/server';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from '../../_mock/guard';
import { FLAKY_OUTAGE_MS } from '../../_mock/mode';
import { dropSession, getSession } from '../../_mock/store';
import { statusPayload } from '../../_mock/status';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/** Состояние обработки и, когда она закончена, результат. */
export async function GET(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) return notFound();

  // Режим flaky: сервис какое-то время не отвечает на опрос, затем оживает.
  if (
    session.mode === 'flaky' &&
    session.completedAt !== null &&
    Date.now() - session.completedAt < FLAKY_OUTAGE_MS
  ) {
    return NextResponse.json(
      { detail: 'Service Unavailable' },
      { status: 503 },
    );
  }

  return NextResponse.json(await statusPayload(session, authorization));
}

/** Отказ от записи: сессия и её «аудио» удаляются. */
export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const { sessionId } = await params;
  dropSession(sessionId);

  return new NextResponse(null, { status: 204 });
}
