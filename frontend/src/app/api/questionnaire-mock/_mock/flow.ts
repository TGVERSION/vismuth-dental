// Автомат шагов анкеты в заглушке — без Next и без файловой системы, чтобы
// проверяться тестами.
//
// Копия логики backend: services/questionnaire_flow.py (`apply_answer`,
// `build_step_descriptor`) и routers/public_questionnaire.py. Сверено
// 28.09.2026. При изменении сценария на сервере заглушка разойдётся с ним —
// сверять снова; ручная проверка против backend — MOCKS=speech npm run dev.
//
// Отличия от backend намеренные: «ИИ» — два заготовленных вопроса
// (script.ts), выдача кода — случайные четыре цифры без проверки
// уникальности в клинике.

import type {
  PublicLinkDoctor,
  QuestionnaireStep,
  QuestionnaireStepAnswer,
} from '@/api';
import {
  APPOINTMENT_DAYS_AHEAD,
  isAppointmentTime,
  toDateInputValue,
} from '@/lib/questionnaire';
import { MOCK_AI_QUESTIONS } from './script';

export type MockStepKey =
  | 'choose_doctor'
  | 'choose_specialization'
  | 'visit_type'
  | 'complaint'
  | 'ai_clarify'
  | 'medications'
  | 'chronic'
  | 'allergy'
  | 'repeat_change'
  | 'repeat_compliance'
  | 'repeat_side_effects'
  | 'patient_info'
  | 'code';

export interface MockQuestionnaire {
  id: string;
  token: string;
  status: 'in_progress' | 'completed';
  currentStep: MockStepKey;
  doctorMembershipId: string | null;
  specializationId: number | null;
  visitType: 'primary' | 'repeat' | null;
  aiQuestionsCount: number;
  aiUnavailable: boolean;
  /** Последний заданный вопрос «ИИ» — текст шага `ai_clarify`. */
  lastAiQuestion: string | null;
  code: string | null;
}

/** Ошибка в терминах backend: статус и `detail`. */
export interface MockError {
  status: number;
  detail: string | Record<string, unknown> | Record<string, unknown>[];
}

export type MockResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MockError };

/** Окружение шага: всё, что backend берёт из базы, настроек и ML. */
export interface MockFlowEnv {
  /** Активные врачи клиники. */
  doctors: PublicLinkDoctor[];
  /** «Сегодня» по часам сервера. */
  today: Date;
  /** ИИ недоступен (режим ai_down). */
  aiDown: boolean;
  /** Код для шага `code`. */
  issueCode: () => string;
}

const FIXED_TEXTS: Partial<Record<MockStepKey, string>> = {
  complaint: 'Что вас беспокоит?',
  medications: 'Принимаете ли сейчас какие-то лекарства? Какие?',
  chronic: 'Есть ли хронические заболевания?',
  allergy: 'Есть ли аллергия на лекарства?',
  repeat_change: 'Что изменилось после прошлого приёма?',
  repeat_compliance: 'Выполняли ли назначения врача?',
  repeat_side_effects: 'Были ли побочные эффекты или новые жалобы?',
};

/** QUESTIONNAIRE_ANSWER_MAX_LEN backend по умолчанию. */
const ANSWER_MAX_LEN = 1000;

/** QUESTIONNAIRE_AI_PRIMARY_MAX / QUESTIONNAIRE_AI_REPEAT_MAX. */
const AI_MAX = { primary: 6, repeat: 2 } as const;

const fail = (
  status: number,
  detail: MockError['detail'],
): { ok: false; error: MockError } => ({
  ok: false,
  error: { status, detail },
});

const dateRange = (today: Date): { min: string; max: string } => {
  const max = new Date(today);
  max.setDate(max.getDate() + APPOINTMENT_DAYS_AHEAD);
  return { min: toDateInputValue(today), max: toDateInputValue(max) };
};

const emptyStep = (step_key: string, step_type: string): QuestionnaireStep => ({
  step_key,
  step_type,
  title: null,
  text: null,
  required: true,
  allow_skip: false,
  allow_none: false,
  choices: [],
  options: [],
  date_min: null,
  date_max: null,
  code: null,
  completed: false,
  truncated: false,
  ai_unavailable: false,
});

const doctorById = (
  env: MockFlowEnv,
  membershipId: string | null | undefined,
): PublicLinkDoctor | undefined =>
  env.doctors.find((doctor) => doctor.membership_id === membershipId);

/**
 * Первый шаг: без врача — выбор врача; у врача несколько специализаций —
 * выбор специализации; одна — она выбирается сама.
 */
export const initialStep = (
  questionnaire: MockQuestionnaire,
  doctor: PublicLinkDoctor | null,
): MockQuestionnaire => {
  if (!doctor) return { ...questionnaire, currentStep: 'choose_doctor' };

  return selectDoctor(questionnaire, doctor);
};

const selectDoctor = (
  questionnaire: MockQuestionnaire,
  doctor: PublicLinkDoctor,
): MockQuestionnaire => {
  const specs = doctor.specializations;
  return {
    ...questionnaire,
    doctorMembershipId: doctor.membership_id,
    specializationId: specs.length === 1 ? specs[0].id : null,
    currentStep: specs.length > 1 ? 'choose_specialization' : 'visit_type',
  };
};

/** Описание текущего шага — `build_step_descriptor`. */
export const describeStep = (
  questionnaire: MockQuestionnaire,
  env: MockFlowEnv,
): QuestionnaireStep => {
  const step = questionnaire.currentStep;

  if (questionnaire.status === 'completed' || step === 'code') {
    return {
      ...emptyStep('code', 'code'),
      title: 'Назовите этот код врачу на приёме',
      code: questionnaire.code,
      completed: true,
      ai_unavailable: questionnaire.aiUnavailable,
    };
  }

  switch (step) {
    case 'choose_doctor':
      return {
        ...emptyStep(step, 'choose_doctor'),
        title: 'Выберите врача',
        options: env.doctors,
      };

    case 'choose_specialization':
      return {
        ...emptyStep(step, 'choose_specialization'),
        title: 'К какому специалисту вы записаны?',
        options:
          doctorById(env, questionnaire.doctorMembershipId)?.specializations ??
          [],
      };

    case 'visit_type':
      return {
        ...emptyStep(step, 'choice'),
        title: 'Тип приёма',
        choices: [
          { value: 'primary', label: 'Первичный' },
          { value: 'repeat', label: 'Повторный' },
        ],
      };

    case 'repeat_change':
      return {
        ...emptyStep(step, 'choice_text'),
        text: FIXED_TEXTS[step] ?? null,
        choices: [
          { value: 'better', label: 'Лучше' },
          { value: 'worse', label: 'Хуже' },
          { value: 'same', label: 'Без изменений' },
        ],
      };

    case 'repeat_compliance':
      return {
        ...emptyStep(step, 'choice'),
        text: FIXED_TEXTS[step] ?? null,
        choices: [
          { value: 'yes', label: 'Да' },
          { value: 'partial', label: 'Частично' },
          { value: 'no', label: 'Нет' },
        ],
      };

    case 'complaint':
      return { ...emptyStep(step, 'text'), text: FIXED_TEXTS[step] ?? null };

    case 'medications':
    case 'chronic':
    case 'allergy':
    case 'repeat_side_effects':
      return {
        ...emptyStep(step, 'text_or_none'),
        text: FIXED_TEXTS[step] ?? null,
        allow_none: true,
      };

    case 'ai_clarify':
      return {
        ...emptyStep(step, 'ai_question'),
        text: questionnaire.lastAiQuestion,
        allow_skip: true,
        ai_unavailable: questionnaire.aiUnavailable,
      };

    case 'patient_info': {
      const range = dateRange(env.today);
      return {
        ...emptyStep(step, 'patient_info'),
        title: 'Имя, отчество, дата и время приёма',
        date_min: range.min,
        date_max: range.max,
      };
    }
  }
};

/**
 * Следующий вопрос «ИИ» или `null`: лимит исчерпан, ИИ недоступен или
 * заготовленные вопросы кончились.
 */
const nextAiQuestion = (
  questionnaire: MockQuestionnaire,
  env: MockFlowEnv,
): { questionnaire: MockQuestionnaire; question: string | null } => {
  if (questionnaire.aiUnavailable) return { questionnaire, question: null };

  const limit = AI_MAX[questionnaire.visitType ?? 'primary'];
  if (questionnaire.aiQuestionsCount >= limit) {
    return { questionnaire, question: null };
  }

  // Как у backend: сбой ML помечает анкету, и дальше она идёт без ИИ.
  if (env.aiDown) {
    return {
      questionnaire: { ...questionnaire, aiUnavailable: true },
      question: null,
    };
  }

  const question = MOCK_AI_QUESTIONS[questionnaire.aiQuestionsCount] ?? null;
  if (!question) return { questionnaire, question: null };

  return {
    questionnaire: {
      ...questionnaire,
      aiQuestionsCount: questionnaire.aiQuestionsCount + 1,
      lastAiQuestion: question,
    },
    question,
  };
};

const enterAiOrNext = (
  questionnaire: MockQuestionnaire,
  env: MockFlowEnv,
  afterAi: MockStepKey,
): MockQuestionnaire => {
  const { questionnaire: next, question } = nextAiQuestion(questionnaire, env);
  return { ...next, currentStep: question ? 'ai_clarify' : afterAi };
};

export interface AppliedAnswer {
  questionnaire: MockQuestionnaire;
  step: QuestionnaireStep;
}

/** Ответ на шаг — `apply_answer`: те же проверки, коды и переходы. */
export const applyAnswer = (
  questionnaire: MockQuestionnaire,
  answer: QuestionnaireStepAnswer & { skip?: boolean },
  env: MockFlowEnv,
): MockResult<AppliedAnswer> => {
  if (questionnaire.status !== 'in_progress') {
    return fail(400, 'Questionnaire is not in progress');
  }
  if (answer.step_key !== questionnaire.currentStep) {
    return fail(409, `Expected step ${questionnaire.currentStep}`);
  }

  let truncated = false;
  let text: string | null = null;
  if (typeof answer.value === 'string') {
    text = answer.value.trim();
    if (text.length > ANSWER_MAX_LEN) {
      text = text.slice(0, ANSWER_MAX_LEN);
      truncated = true;
    }
  }

  let next: MockQuestionnaire = questionnaire;

  switch (questionnaire.currentStep) {
    case 'choose_doctor': {
      if (!answer.doctor_membership_id) {
        return fail(400, 'doctor_membership_id required');
      }
      const doctor = doctorById(env, answer.doctor_membership_id);
      if (!doctor) return fail(400, 'Doctor not available');
      next = selectDoctor(questionnaire, doctor);
      break;
    }

    case 'choose_specialization': {
      if (typeof answer.specialization_id !== 'number') {
        return fail(400, 'specialization_id required');
      }
      const specs =
        doctorById(env, questionnaire.doctorMembershipId)?.specializations ??
        [];
      if (!specs.some((spec) => spec.id === answer.specialization_id)) {
        return fail(400, 'Specialization not available for doctor');
      }
      next = {
        ...questionnaire,
        specializationId: answer.specialization_id,
        currentStep: 'visit_type',
      };
      break;
    }

    case 'visit_type': {
      if (answer.choice !== 'primary' && answer.choice !== 'repeat') {
        return fail(400, 'visit_type must be primary or repeat');
      }
      next = {
        ...questionnaire,
        visitType: answer.choice,
        currentStep:
          answer.choice === 'primary' ? 'complaint' : 'repeat_change',
      };
      break;
    }

    case 'complaint': {
      if (!text) return fail(400, 'Complaint is required');
      next = enterAiOrNext(questionnaire, env, 'medications');
      break;
    }

    case 'ai_clarify': {
      if (!answer.skip && text === null && !answer.none) {
        return fail(400, 'Answer text required');
      }
      const after: MockStepKey =
        questionnaire.visitType === 'primary' ? 'medications' : 'patient_info';
      next = enterAiOrNext(questionnaire, env, after);
      break;
    }

    case 'medications':
    case 'chronic':
    case 'allergy':
    case 'repeat_side_effects': {
      if (!answer.none && text === null) return fail(400, 'Answer required');
      const step = questionnaire.currentStep;
      next =
        step === 'medications'
          ? { ...questionnaire, currentStep: 'chronic' }
          : step === 'chronic'
            ? { ...questionnaire, currentStep: 'allergy' }
            : step === 'allergy'
              ? { ...questionnaire, currentStep: 'patient_info' }
              : enterAiOrNext(questionnaire, env, 'patient_info');
      break;
    }

    case 'repeat_change': {
      if (!['better', 'worse', 'same'].includes(answer.choice ?? '')) {
        return fail(400, 'Invalid choice');
      }
      next = { ...questionnaire, currentStep: 'repeat_compliance' };
      break;
    }

    case 'repeat_compliance': {
      if (!['yes', 'partial', 'no'].includes(answer.choice ?? '')) {
        return fail(400, 'Invalid choice');
      }
      next = { ...questionnaire, currentStep: 'repeat_side_effects' };
      break;
    }

    case 'patient_info': {
      if (
        !answer.first_name ||
        !answer.appointment_date ||
        !answer.appointment_time
      ) {
        return fail(
          400,
          'first_name, appointment_date and appointment_time required',
        );
      }
      const range = dateRange(env.today);
      if (
        answer.appointment_date < range.min ||
        answer.appointment_date > range.max
      ) {
        return fail(400, 'appointment_date out of range');
      }
      // Любое время суток, как у backend: списка слотов больше нет.
      if (!isAppointmentTime(answer.appointment_time)) {
        return fail(400, 'appointment_time must be HH:MM');
      }
      next = {
        ...questionnaire,
        status: 'completed',
        currentStep: 'code',
        code: env.issueCode(),
      };
      break;
    }

    default:
      return fail(400, `Unsupported step ${questionnaire.currentStep}`);
  }

  return {
    ok: true,
    value: {
      questionnaire: next,
      step: { ...describeStep(next, env), truncated },
    },
  };
};

// ---------------------------------------------------------------------------
// Старт анкеты — create_questionnaire

export interface MockStartContext {
  /** Slug ведёт на врача (а не на клинику). */
  slugDoctor: PublicLinkDoctor | null;
  /** Врач ссылки не ведёт приём. */
  slugDoctorInactive: boolean;
  env: MockFlowEnv;
}

/** Проверка тела старта и выбор врача — после лимитов, как у backend. */
export const resolveStartDoctor = (
  body: { doctor_membership_id?: string | null },
  context: MockStartContext,
): MockResult<PublicLinkDoctor | null> => {
  let doctor = context.slugDoctor;

  if (body.doctor_membership_id) {
    const chosen = doctorById(context.env, body.doctor_membership_id);
    if (!chosen) return fail(400, 'Doctor not available');
    doctor = chosen;
  }

  if (context.slugDoctorInactive) {
    return fail(400, {
      code: 'doctor_inactive',
      message: 'Врач не ведёт приём, выберите другого',
    });
  }

  return { ok: true, value: doctor };
};

/** Проверка тела старта: FastAPI отвечает 422 с массивом ошибок. */
export const validateStartBody = (
  body: unknown,
): MockResult<{ slug: string; doctor_membership_id: string | null }> => {
  if (typeof body !== 'object' || body === null) {
    return fail(422, [{ loc: ['body'], msg: 'Field required' }]);
  }
  const { slug, doctor_membership_id: doctorId } = body as Record<
    string,
    unknown
  >;
  if (typeof slug !== 'string' || slug.length < 4 || slug.length > 32) {
    return fail(422, [
      { loc: ['body', 'slug'], msg: 'String should have 4 to 32 characters' },
    ]);
  }
  if (
    doctorId !== undefined &&
    doctorId !== null &&
    typeof doctorId !== 'string'
  ) {
    return fail(422, [
      {
        loc: ['body', 'doctor_membership_id'],
        msg: 'Input should be a valid UUID',
      },
    ]);
  }

  return {
    ok: true,
    value: { slug, doctor_membership_id: (doctorId as string | null) ?? null },
  };
};

export const newQuestionnaire = (
  id: string,
  token: string,
): MockQuestionnaire => ({
  id,
  token,
  status: 'in_progress',
  currentStep: 'choose_doctor',
  doctorMembershipId: null,
  specializationId: null,
  visitType: null,
  aiQuestionsCount: 0,
  aiUnavailable: false,
  lastAiQuestion: null,
  code: null,
});
