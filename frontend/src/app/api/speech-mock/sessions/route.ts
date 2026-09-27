import { NextResponse } from 'next/server';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from '../_mock/guard';
import { createSession, findSessionsByProtocol } from '../_mock/store';
import { statusPayload } from '../_mock/status';

/** Создание сессии записи приёма. */
export async function POST(request: Request) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    protocol_id?: string;
  } | null;

  if (!body?.protocol_id) {
    return NextResponse.json(
      { detail: 'protocol_id is required' },
      { status: 422 },
    );
  }

  const session = createSession(body.protocol_id);
  return NextResponse.json({ session_id: session.sessionId });
}

/** Поиск сессий протокола: нужен, чтобы подхватить обработку после перезагрузки. */
export async function GET(request: Request) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const protocolId = new URL(request.url).searchParams.get('protocol_id');
  if (!protocolId) {
    return NextResponse.json(
      { detail: 'protocol_id is required' },
      { status: 422 },
    );
  }

  const sessions = findSessionsByProtocol(protocolId);
  const payloads = await Promise.all(
    sessions.map((session) => statusPayload(session, authorization)),
  );

  return NextResponse.json(payloads);
}
