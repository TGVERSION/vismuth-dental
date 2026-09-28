import { NextResponse } from 'next/server';
import { errorResponse, isMockEnabled, notFound } from '../../../_mock/guard';
import { loadForToken, mockEnv } from '../../../_mock/env';
import { describeStep } from '../../../_mock/flow';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Текущий шаг анкеты — `get_step` backend. Нужен для продолжения после
 * перезагрузки и после 409 «Expected step».
 */
export async function GET(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const { id } = await params;
  const loaded = loadForToken(request, id);
  if (!loaded.ok) return errorResponse(loaded.error);

  return NextResponse.json(
    describeStep(loaded.value, mockEnv(loaded.value.mode)),
  );
}
