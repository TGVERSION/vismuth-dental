import { NextResponse } from 'next/server';
import { isMockEnabled, notFound } from '../../_mock/guard';
import { currentMockMode, stateForMode } from '../../_mock/mode';
import { mockDoctors } from '../../_mock/doctors';
import type { QuestionnaireLink } from '@/api';

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Что стоит за ссылкой: брендинг клиники, тип ссылки и состояние.
 *
 * Ссылкой врача считается код, содержащий `doctor`, — так на одном стенде
 * проверяются оба сценария: `/q/demo` и `/q/demo-doctor`.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const { code } = await params;
  const mode = currentMockMode();
  const isDoctorLink = code.includes('doctor');

  const payload: QuestionnaireLink = {
    clinic: {
      name: 'Клиника «Демо»',
      phone: '+7 900 000-00-00',
      // Относительный путь того же origin: файл уже лежит в public/.
      logo_url: '/logo.svg',
      brand_color: '#1B4B8F',
    },
    target: isDoctorLink ? 'doctor' : 'clinic',
    doctor: isDoctorLink ? mockDoctors[0] : null,
    // Шаг согласия по умолчанию выключен — решение 6.
    consent_required: false,
    state: stateForMode(mode),
  };

  return NextResponse.json(payload);
}
