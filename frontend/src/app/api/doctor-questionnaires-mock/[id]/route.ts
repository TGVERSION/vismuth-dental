import { NextResponse } from 'next/server';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from '../_mock/guard';
import { applyMockMode, currentMockMode } from '../_mock/mode';
import { findQuestionnaire } from '../_mock/seed';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Открытая анкета. */
export async function GET(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();
  if (!requireAuth(request)) return unauthorized();

  const failure = await applyMockMode(currentMockMode());
  if (failure) return failure;

  const { id } = await params;
  const questionnaire = findQuestionnaire(id);
  if (!questionnaire) {
    return NextResponse.json(
      { detail: 'Questionnaire not found' },
      { status: 404 },
    );
  }

  return NextResponse.json(questionnaire);
}
