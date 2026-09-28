import { NextResponse } from 'next/server';
import type { PublicLink } from '@/api';
import { isMockEnabled, notFound } from '../../_mock/guard';
import { currentMockMode } from '../../_mock/mode';
import {
  INACTIVE_DOCTOR_ID,
  MOCK_CLINIC,
  doctorForSlug,
} from '../../_mock/doctors';
import { mockEnv } from '../../_mock/env';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const UNAVAILABLE_MESSAGE =
  'Сервис временно недоступен. По вопросам записи ' +
  `обращайтесь в клинику по телефону ${MOCK_CLINIC.phone}`;

/**
 * Что стоит за ссылкой — `get_public_link` backend: брендинг, тип ссылки,
 * активные врачи клиники и блокировка.
 *
 * Ссылкой врача считается slug, содержащий `doctor` (см. doctors.ts), — так
 * на одном стенде проверяются оба сценария: `/q/demo` и `/q/demo-doctor`.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const { slug } = await params;
  const mode = currentMockMode();
  const slugDoctor = doctorForSlug(slug);

  const base: PublicLink = {
    link_type: slugDoctor ? 'doctor' : 'clinic',
    ...MOCK_CLINIC,
    doctor: null,
    doctors: mockEnv(mode).doctors,
    blocked: false,
    block_code: null,
    block_message: null,
  };

  if (mode === 'subscription_expired' || mode === 'clinic_daily_limit') {
    return NextResponse.json({
      ...base,
      blocked: true,
      block_code: mode,
      block_message: UNAVAILABLE_MESSAGE,
    } satisfies PublicLink);
  }

  if (
    slugDoctor &&
    mode === 'doctor_inactive' &&
    slugDoctor.membership_id === INACTIVE_DOCTOR_ID
  ) {
    return NextResponse.json({
      ...base,
      blocked: true,
      block_code: 'doctor_inactive',
      block_message: 'Врач не ведёт приём, выберите другого',
    } satisfies PublicLink);
  }

  return NextResponse.json({
    ...base,
    doctor: slugDoctor,
  } satisfies PublicLink);
}
