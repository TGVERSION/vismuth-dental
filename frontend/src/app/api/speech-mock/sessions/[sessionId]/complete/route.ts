import { NextResponse } from 'next/server';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from '../../../_mock/guard';
import { completeSession, getSession } from '../../../_mock/store';
import { statusPayload } from '../../../_mock/status';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/** Запись закончена — «обработка» стартует и занимает несколько секунд. */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) return notFound();

  const completed = completeSession(sessionId) ?? session;

  return NextResponse.json(await statusPayload(completed, authorization));
}
