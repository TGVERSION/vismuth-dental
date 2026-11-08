import { describe, expect, it } from 'vitest';
import type { PublicLinkDoctor, QuestionnaireStepAnswer } from '@/api';
import {
  applyAnswer,
  describeStep,
  initialStep,
  newQuestionnaire,
  resolveStartDoctor,
  validateStartBody,
  type MockFlowEnv,
  type MockQuestionnaire,
} from './flow';
import { MOCK_AI_QUESTIONS } from './script';

const oneSpec: PublicLinkDoctor = {
  membership_id: 'doc-one',
  public_slug: 'demo-doctor-one',
  photo_url: null,
  first_name: 'Светлана',
  last_name: 'Егорова',
  middle_name: null,
  specializations: [{ id: 2, code: null, name: 'Терапевт' }],
};

const manySpecs: PublicLinkDoctor = {
  ...oneSpec,
  membership_id: 'doc-many',
  specializations: [
    { id: 1, code: null, name: 'Кардиолог' },
    { id: 2, code: null, name: 'Терапевт' },
  ],
};

const makeEnv = (patch: Partial<MockFlowEnv> = {}): MockFlowEnv => ({
  doctors: [oneSpec, manySpecs],
  today: new Date(2026, 8, 28),
  aiDown: false,
  issueCode: () => '4321',
  ...patch,
});

/** Прогнать ответы подряд; каждый обязан быть принят. */
const run = (
  start: MockQuestionnaire,
  answers: QuestionnaireStepAnswer[],
  env: MockFlowEnv = makeEnv(),
) => {
  let questionnaire = start;
  const stepKeys: string[] = [];

  for (const answer of answers) {
    const result = applyAnswer(questionnaire, answer, env);
    if (!result.ok) {
      throw new Error(
        `${answer.step_key}: ${result.error.status} ${JSON.stringify(result.error.detail)}`,
      );
    }
    questionnaire = result.value.questionnaire;
    stepKeys.push(result.value.step.step_key);
  }

  return { questionnaire, stepKeys, step: describeStep(questionnaire, env) };
};

const fresh = () => newQuestionnaire('q-1', 'token-1');

const atVisitType = (): MockQuestionnaire => ({
  ...initialStep(fresh(), oneSpec),
  currentStep: 'visit_type',
});
const atRepeatChange = (): MockQuestionnaire => ({
  ...initialStep(fresh(), oneSpec),
  visitType: 'repeat',
  currentStep: 'repeat_change',
});

describe('initialStep', () => {
  it('без врача — выбор врача', () => {
    expect(initialStep(fresh(), null).currentStep).toBe('choose_doctor');
  });

  it('у врача одна специализация — сразу жалобы первичного приёма', () => {
    const questionnaire = initialStep(fresh(), oneSpec);
    expect(questionnaire.currentStep).toBe('complaint');
    expect(questionnaire.visitType).toBe('primary');
    expect(questionnaire.specializationId).toBe(2);
  });

  it('у врача несколько — выбор специализации', () => {
    expect(initialStep(fresh(), manySpecs).currentStep).toBe(
      'choose_specialization',
    );
  });
});

describe('первичный приём', () => {
  it('проходит до кода с двумя уточнениями ИИ', () => {
    const { stepKeys, step, questionnaire } = run(fresh(), [
      { step_key: 'choose_doctor', doctor_membership_id: 'doc-many' },
      { step_key: 'choose_specialization', specialization_id: 1 },
      { step_key: 'complaint', value: 'болит голова' },
      { step_key: 'ai_clarify', value: 'неделю' },
      { step_key: 'ai_clarify', value: 'ничего' },
      { step_key: 'medications', none: true },
      { step_key: 'chronic', value: 'гипертония' },
      { step_key: 'allergy', none: true },
      {
        step_key: 'patient_info',
        first_name: 'Анна',
        appointment_date: '2026-10-01',
        appointment_time: '09:30',
      },
    ]);

    expect(stepKeys).toEqual([
      'choose_specialization',
      'complaint',
      'ai_clarify',
      'ai_clarify',
      'medications',
      'chronic',
      'allergy',
      'patient_info',
      'code',
    ]);
    expect(step).toMatchObject({
      step_key: 'code',
      code: '4321',
      completed: true,
      ai_unavailable: false,
    });
    expect(questionnaire.status).toBe('completed');
  });

  it('уточнение ИИ — текст заготовленного вопроса', () => {
    const { step } = run({ ...atVisitType(), currentStep: 'complaint' }, [
      { step_key: 'complaint', value: 'кашель' },
    ]);

    expect(step).toMatchObject({
      step_key: 'ai_clarify',
      step_type: 'ai_question',
      text: MOCK_AI_QUESTIONS[0],
      allow_skip: true,
    });
  });

  it('ИИ недоступен — без уточнений, пометка на коде', () => {
    const env = makeEnv({ aiDown: true });
    const { stepKeys, step } = run(
      { ...atVisitType(), currentStep: 'complaint' },
      [
        { step_key: 'complaint', value: 'кашель' },
        { step_key: 'medications', none: true },
        { step_key: 'chronic', none: true },
        { step_key: 'allergy', none: true },
        {
          step_key: 'patient_info',
          first_name: 'Анна',
          appointment_date: '2026-09-28',
          appointment_time: '18:00',
        },
      ],
      env,
    );

    expect(stepKeys).not.toContain('ai_clarify');
    expect(step.ai_unavailable).toBe(true);
  });
});

describe('повторный приём', () => {
  it('проходит до кода; уточнений не больше двух', () => {
    const { stepKeys } = run(atRepeatChange(), [
      { step_key: 'repeat_change', choice: 'better', value: 'меньше болит' },
      { step_key: 'repeat_compliance', choice: 'partial' },
      { step_key: 'repeat_side_effects', none: true },
      { step_key: 'ai_clarify', value: 'да' },
      { step_key: 'ai_clarify', value: 'нет' },
      {
        step_key: 'patient_info',
        first_name: 'Анна',
        middle_name: 'Сергеевна',
        appointment_date: '2026-10-28',
        appointment_time: '10:00',
      },
    ]);

    expect(stepKeys).toEqual([
      'repeat_compliance',
      'repeat_side_effects',
      'ai_clarify',
      'ai_clarify',
      'patient_info',
      'code',
    ]);
  });

  it('шаги с выбором описаны как у backend', () => {
    const { step } = run(atRepeatChange(), []);

    expect(step).toMatchObject({
      step_key: 'repeat_change',
      step_type: 'choice_text',
      text: 'Что изменилось после прошлого приёма?',
    });
    expect(step.choices.map((choice) => choice.value)).toEqual([
      'better',
      'worse',
      'same',
    ]);
  });
});

describe('отказы', () => {
  it('чужой step_key — 409 с ожидаемым шагом', () => {
    const result = applyAnswer(
      atVisitType(),
      { step_key: 'complaint', value: 'кашель' },
      makeEnv(),
    );

    expect(result).toEqual({
      ok: false,
      error: { status: 409, detail: 'Expected step visit_type' },
    });
  });

  it('шаг с выбором без choice — 400', () => {
    const visitType = applyAnswer(
      atVisitType(),
      { step_key: 'visit_type', value: 'повторный' },
      makeEnv(),
    );
    expect(visitType.ok).toBe(false);
    if (!visitType.ok) expect(visitType.error.status).toBe(400);

    const { questionnaire } = run(atRepeatChange(), []);
    const change = applyAnswer(
      questionnaire,
      { step_key: 'repeat_change', value: 'лучше' },
      makeEnv(),
    );
    expect(change).toEqual({
      ok: false,
      error: { status: 400, detail: 'Invalid choice' },
    });
  });

  it('шаг «Нет» без ответа — 400, с none — принят', () => {
    const { questionnaire } = run(
      { ...atVisitType(), currentStep: 'complaint' },
      [{ step_key: 'complaint', value: 'кашель' }],
      makeEnv({ aiDown: true }),
    );

    expect(
      applyAnswer(questionnaire, { step_key: 'medications' }, makeEnv()).ok,
    ).toBe(false);
    expect(
      applyAnswer(
        questionnaire,
        { step_key: 'medications', none: true },
        makeEnv(),
      ).ok,
    ).toBe(true);
  });

  it('пустая жалоба — 400', () => {
    const { questionnaire } = run(
      { ...atVisitType(), currentStep: 'complaint' },
      [],
    );
    expect(
      applyAnswer(
        questionnaire,
        { step_key: 'complaint', value: '   ' },
        makeEnv(),
      ).ok,
    ).toBe(false);
  });

  it('данные приёма: дата вне диапазона и некорректное время — 400', () => {
    const { questionnaire } = run(
      { ...atVisitType(), currentStep: 'complaint' },
      [
        { step_key: 'complaint', value: 'кашель' },
        { step_key: 'medications', none: true },
        { step_key: 'chronic', none: true },
        { step_key: 'allergy', none: true },
      ],
      makeEnv({ aiDown: true }),
    );
    const base = { step_key: 'patient_info', first_name: 'Анна' };

    expect(
      applyAnswer(
        questionnaire,
        { ...base, appointment_date: '2026-10-29', appointment_time: '09:00' },
        makeEnv(),
      ),
    ).toEqual({
      ok: false,
      error: { status: 400, detail: 'appointment_date out of range' },
    });
    for (const appointment_time of ['25:00', '12:60', '9:30', 'утром']) {
      expect(
        applyAnswer(
          questionnaire,
          { ...base, appointment_date: '2026-10-01', appointment_time },
          makeEnv(),
        ),
      ).toEqual({
        ok: false,
        error: { status: 400, detail: 'appointment_time must be HH:MM' },
      });
    }
  });

  it('данные приёма: время вне прежних слотов принимается', () => {
    const { questionnaire } = run(
      { ...atVisitType(), currentStep: 'complaint' },
      [
        { step_key: 'complaint', value: 'кашель' },
        { step_key: 'medications', none: true },
        { step_key: 'chronic', none: true },
        { step_key: 'allergy', none: true },
      ],
      makeEnv({ aiDown: true }),
    );
    const base = {
      step_key: 'patient_info',
      first_name: 'Анна',
      appointment_date: '2026-10-01',
    };

    for (const appointment_time of ['00:00', '08:15', '19:30', '23:59']) {
      const result = applyAnswer(
        questionnaire,
        { ...base, appointment_time },
        makeEnv(),
      );

      expect(result.ok).toBe(true);
    }
  });

  it('завершённая анкета — 400 «not in progress»', () => {
    const completed: MockQuestionnaire = {
      ...atVisitType(),
      status: 'completed',
      currentStep: 'code',
    };

    expect(
      applyAnswer(completed, { step_key: 'patient_info' }, makeEnv()),
    ).toEqual({
      ok: false,
      error: { status: 400, detail: 'Questionnaire is not in progress' },
    });
  });

  it('недоступный врач и чужая специализация — 400', () => {
    expect(
      applyAnswer(
        fresh(),
        { step_key: 'choose_doctor', doctor_membership_id: 'doc-x' },
        makeEnv(),
      ).ok,
    ).toBe(false);

    const specialization = initialStep(fresh(), manySpecs);
    expect(
      applyAnswer(
        specialization,
        { step_key: 'choose_specialization', specialization_id: 99 },
        makeEnv(),
      ).ok,
    ).toBe(false);
  });
});

describe('describeStep', () => {
  it('данные приёма — диапазон дат по «сегодня» сервера, слотов нет', () => {
    const questionnaire: MockQuestionnaire = {
      ...atVisitType(),
      currentStep: 'patient_info',
    };

    const step = describeStep(questionnaire, makeEnv());

    expect(step).toMatchObject({
      step_key: 'patient_info',
      date_min: '2026-09-28',
      date_max: '2026-10-28',
    });
    // Backend убрал поле из дескриптора — заглушка не должна его возвращать.
    expect(step).not.toHaveProperty('time_slots');
  });

  it('выбор врача — врачи в options', () => {
    expect(describeStep(fresh(), makeEnv()).options).toEqual([
      oneSpec,
      manySpecs,
    ]);
  });
});

describe('старт', () => {
  it('тело: slug от 4 до 32 символов', () => {
    expect(validateStartBody({ slug: 'demo' }).ok).toBe(true);
    expect(validateStartBody({ slug: 'abc' }).ok).toBe(false);
    expect(validateStartBody(null).ok).toBe(false);
  });

  it('неактивный врач ссылки — 400 doctor_inactive даже с выбранным врачом', () => {
    const result = resolveStartDoctor(
      { doctor_membership_id: 'doc-one' },
      { slugDoctor: manySpecs, slugDoctorInactive: true, env: makeEnv() },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        status: 400,
        detail: {
          code: 'doctor_inactive',
          message: 'Врач не ведёт приём, выберите другого',
        },
      },
    });
  });

  it('выбранный врач важнее врача ссылки; недоступный — 400', () => {
    expect(
      resolveStartDoctor(
        { doctor_membership_id: 'doc-one' },
        { slugDoctor: null, slugDoctorInactive: false, env: makeEnv() },
      ),
    ).toEqual({ ok: true, value: oneSpec });
    expect(
      resolveStartDoctor(
        { doctor_membership_id: 'doc-x' },
        { slugDoctor: null, slugDoctorInactive: false, env: makeEnv() },
      ).ok,
    ).toBe(false);
  });
});

it('stale visit-type choice is treated as primary', () => {
  const result = applyAnswer(
    atVisitType(),
    { step_key: 'visit_type', choice: 'repeat' },
    makeEnv(),
  );
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.questionnaire.visitType).toBe('primary');
    expect(result.value.step.step_key).toBe('complaint');
  }
});

it('adds only three small chat questions for an adult primary gastro visit', () => {
  const doctor = {
    ...oneSpec,
    specializations: [{ id: 8, code: 'gastro', name: 'Гастроэнтеролог' }],
  };
  const env = makeEnv({ doctors: [doctor] });
  const q = {
    ...initialStep(fresh(), doctor),
    currentStep: 'allergy' as const,
  };
  const { step, questionnaire } = run(
    q,
    [{ step_key: 'allergy', none: true }],
    env,
  );
  expect(step.step_key).toBe('stool_changes');
  expect(step.step_type).toBe('text');
  expect(step.choices).toHaveLength(2);
  const completed = run(
    questionnaire,
    [
      { step_key: 'stool_changes', value: 'Жидкий стул неделю' },
      { step_key: 'weight_changes', choice: 'unknown' },
      { step_key: 'family_history', value: 'У сестры целиакия' },
    ],
    env,
  );
  expect(completed.step.step_key).toBe('patient_info');
});
