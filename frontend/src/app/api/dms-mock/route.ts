import { NextResponse } from 'next/server';
import type { DmsJustifyRequest } from '@/api';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from './_mock/guard';
import { buildMockReply } from './_mock/adapt';

/** Ответ модели идёт десятки секунд; заглушке хватает нескольких. */
const MOCK_DELAY_MS = 4000;

const isRequest = (body: unknown): body is DmsJustifyRequest => {
  if (!body || typeof body !== 'object') return false;
  const { main_diagnosis, sections } = body as Record<string, unknown>;
  return (
    typeof main_diagnosis === 'string' &&
    Array.isArray(sections) &&
    sections.every(
      (section) =>
        section &&
        typeof section.key === 'string' &&
        typeof section.value === 'string',
    )
  );
};

/** Обоснование назначений для ДМС. Правила ответа — в _mock/adapt.ts. */
export async function POST(request: Request) {
  if (!isMockEnabled) return notFound();

  if (!requireAuth(request)) return unauthorized();

  const body: unknown = await request.json().catch(() => null);
  if (!isRequest(body)) {
    return NextResponse.json(
      { detail: 'main_diagnosis and sections are required' },
      { status: 422 },
    );
  }

  const reply = buildMockReply(body);
  // Клинрек backend ищет до вызова модели, поэтому отказ 422 приходит сразу,
  // а ждать приходится только ответа модели или её сбоя.
  if (reply.status !== 422) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  }
  return NextResponse.json(reply.body, { status: reply.status });
}
