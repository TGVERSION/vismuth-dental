import { NextResponse } from 'next/server';
import type { QuestionnaireStartResponse } from '@/api';
import { errorResponse, isMockEnabled, notFound } from '../_mock/guard';
import { currentMockMode } from '../_mock/mode';
import {
  INACTIVE_DOCTOR_ID,
  MOCK_CLINIC,
  doctorForSlug,
} from '../_mock/doctors';
import { mockEnv } from '../_mock/env';
import {
  describeStep,
  initialStep,
  resolveStartDoctor,
  validateStartBody,
} from '../_mock/flow';
import { createQuestionnaire, saveQuestionnaire } from '../_mock/store';

const UNAVAILABLE_MESSAGE =
  'Сервис временно недоступен. По вопросам записи ' +
  `обращайтесь в клинику по телефону ${MOCK_CLINIC.phone}`;

/**
 * Старт анкеты — `create_questionnaire` backend. Анкета создаётся в момент
 * нажатия «Начать»: по ссылке клиники первый шаг — выбор врача, и уход на
 * нём попадает в статистику брошенных.
 *
 * Лимиты в заглушке не считаются — их включают режимы (mode.ts), с теми же
 * статусами и кодами, что у backend.
 */
export async function POST(request: Request) {
  if (!isMockEnabled) return notFound();

  if (!request.headers.get('x-device-id')) {
    return errorResponse({
      status: 400,
      detail: 'X-Device-Id header required',
    });
  }

  const parsed = validateStartBody(await request.json().catch(() => null));
  if (!parsed.ok) return errorResponse(parsed.error);

  const mode = currentMockMode();
  switch (mode) {
    case 'subscription_expired':
    case 'clinic_daily_limit':
      return errorResponse({
        status: 503,
        detail: {
          code: mode,
          message: UNAVAILABLE_MESSAGE,
          phone: MOCK_CLINIC.phone,
        },
      });
    case 'device_limit':
      return errorResponse({
        status: 429,
        detail: {
          code: 'device_limit',
          message:
            'Вы уже заполнили анкету. Если нужно ещё - обратитесь в клинику',
        },
      });
    case 'ip_limit':
      return errorResponse({
        status: 429,
        detail: { code: 'ip_limit', message: 'Попробуйте позже' },
      });
  }

  const env = mockEnv(mode);
  const slugDoctor = doctorForSlug(parsed.value.slug);
  const doctor = resolveStartDoctor(parsed.value, {
    slugDoctor,
    slugDoctorInactive:
      mode === 'doctor_inactive' &&
      slugDoctor?.membership_id === INACTIVE_DOCTOR_ID,
    env,
  });
  if (!doctor.ok) return errorResponse(doctor.error);

  const created = createQuestionnaire(mode);
  const started = { ...created, ...initialStep(created, doctor.value) };
  saveQuestionnaire(started);

  const payload: QuestionnaireStartResponse = {
    id: started.id,
    token: started.token,
    step: describeStep(started, env),
  };

  return NextResponse.json(payload, { status: 201 });
}
