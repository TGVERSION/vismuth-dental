import { describe, expect, it } from 'vitest';
import type { PublicLink, PublicLinkDoctor, QuestionnaireStep } from '@/api';
import { ApiError } from '@/api/base-client';
import {
  ANSWER_MAX_LENGTH,
  TIME_HOURS,
  TIME_MINUTES,
  VISIT_TYPE_QUESTION,
  buildAnswer,
  chatPrompt,
  clampAnswer,
  clinicBranding,
  collectSpecializations,
  doctorFullName,
  doctorSpecializationNames,
  estimateProgress,
  filterDoctors,
  isAppointmentTime,
  isDateInRange,
  isSameStep,
  isValidPatientName,
  linkBlock,
  parseDoctorOptions,
  parseSpecializationOptions,
  patientReplyText,
  screenForStep,
  splitAppointmentTime,
  startErrorBlock,
} from './questionnaire';

const makeDoctor = (
  id: string,
  last: string,
  first: string,
  middle: string | null,
  specializations: string[],
): PublicLinkDoctor => ({
  membership_id: id,
  public_slug: null,
  photo_url: null,
  first_name: first,
  last_name: last,
  middle_name: middle,
  specializations: specializations.map((name, index) => ({
    id: index + 1,
    code: null,
    name,
  })),
});

const doctors: PublicLinkDoctor[] = [
  makeDoctor('1', 'Алексеев', 'Николай', 'Петрович', ['Кардиолог', 'Терапевт']),
  makeDoctor('2', 'Никитин', 'Фёдор', 'Николаевич', ['Кардиолог', 'Хирург']),
  makeDoctor('3', 'Егорова', 'Светлана', 'Ивановна', ['Терапевт']),
];

const makeStep = (patch: Partial<QuestionnaireStep>): QuestionnaireStep => ({
  step_key: 'complaint',
  step_type: 'text',
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
  ...patch,
});

const makeLink = (patch: Partial<PublicLink> = {}): PublicLink => ({
  link_type: 'clinic',
  clinic_id: 'clinic-1',
  clinic_name: 'Клиника «Демо»',
  phone: '+7 900 000-00-00',
  logo_url: '/logo.svg',
  brand_color: '#1B4B8F',
  clinic_public_slug: 'demo',
  doctor: null,
  doctors,
  blocked: false,
  block_code: null,
  block_message: null,
  ...patch,
});

// Шаги в том виде, в каком их отдаёт services/questionnaire_flow.py.
const steps = {
  chooseDoctor: makeStep({
    step_key: 'choose_doctor',
    step_type: 'choose_doctor',
    title: 'Выберите врача',
  }),
  chooseSpecialization: makeStep({
    step_key: 'choose_specialization',
    step_type: 'choose_specialization',
    title: 'К какому специалисту вы записаны?',
    options: [
      { id: 7, code: 'cardio', name: 'Кардиолог' },
      { id: 9, code: null, name: 'Терапевт' },
    ],
  }),
  visitType: makeStep({
    step_key: 'visit_type',
    step_type: 'choice',
    title: 'Тип приёма',
    choices: [
      { value: 'primary', label: 'Первичный' },
      { value: 'repeat', label: 'Повторный' },
    ],
  }),
  complaint: makeStep({
    step_key: 'complaint',
    step_type: 'text',
    text: 'Что вас беспокоит?',
  }),
  aiClarify: makeStep({
    step_key: 'ai_clarify',
    step_type: 'ai_question',
    text: 'Как давно это началось?',
    allow_skip: true,
  }),
  medications: makeStep({
    step_key: 'medications',
    step_type: 'text_or_none',
    text: 'Принимаете ли сейчас какие-то лекарства? Какие?',
    allow_none: true,
  }),
  repeatChange: makeStep({
    step_key: 'repeat_change',
    step_type: 'choice_text',
    text: 'Что изменилось после прошлого приёма?',
    choices: [
      { value: 'better', label: 'Лучше' },
      { value: 'worse', label: 'Хуже' },
      { value: 'same', label: 'Без изменений' },
    ],
  }),
  repeatCompliance: makeStep({
    step_key: 'repeat_compliance',
    step_type: 'choice',
    text: 'Выполняли ли назначения врача?',
    choices: [
      { value: 'yes', label: 'Да' },
      { value: 'partial', label: 'Частично' },
      { value: 'no', label: 'Нет' },
    ],
  }),
  repeatSideEffects: makeStep({
    step_key: 'repeat_side_effects',
    step_type: 'text_or_none',
    text: 'Были ли побочные эффекты или новые жалобы?',
    allow_none: true,
  }),
  patientInfo: makeStep({
    step_key: 'patient_info',
    step_type: 'patient_info',
    title: 'Имя, отчество, дата и время приёма',
    date_min: '2026-09-28',
    date_max: '2026-10-28',
  }),
  code: makeStep({
    step_key: 'code',
    step_type: 'code',
    code: '1234',
    completed: true,
  }),
};

describe('clinicBranding', () => {
  it('берёт брендинг из ссылки', () => {
    expect(clinicBranding(makeLink())).toEqual({
      name: 'Клиника «Демо»',
      phone: '+7 900 000-00-00',
      logo_url: '/logo.svg',
      brand_color: '#1B4B8F',
    });
  });

  it('без ссылки — нейтральная клиника', () => {
    expect(clinicBranding(null)).toEqual({
      name: 'Клиника',
      phone: null,
      logo_url: null,
      brand_color: null,
    });
  });
});

describe('linkBlock', () => {
  it('незаблокированная ссылка и её отсутствие — не блок', () => {
    expect(linkBlock(makeLink())).toBeNull();
    expect(linkBlock(null)).toBeNull();
    // Код без признака blocked не блокирует.
    expect(
      linkBlock(makeLink({ blocked: false, block_code: 'doctor_inactive' })),
    ).toBeNull();
  });

  it('три кода backend', () => {
    for (const code of [
      'subscription_expired',
      'clinic_daily_limit',
      'doctor_inactive',
    ] as const) {
      expect(linkBlock(makeLink({ blocked: true, block_code: code }))).toBe(
        code,
      );
    }
  });

  it('неизвестный или пустой код — самый общий текст', () => {
    expect(
      linkBlock(makeLink({ blocked: true, block_code: 'new_reason' })),
    ).toBe('subscription_expired');
    expect(linkBlock(makeLink({ blocked: true, block_code: null }))).toBe(
      'subscription_expired',
    );
  });
});

describe('startErrorBlock', () => {
  it('пять кодов ошибок старта', () => {
    for (const code of [
      'device_limit',
      'ip_limit',
      'subscription_expired',
      'clinic_daily_limit',
      'doctor_inactive',
    ] as const) {
      expect(startErrorBlock(new ApiError('отказ', 429, code))).toBe(code);
    }
  });

  it('ApiError без кода или с чужим кодом — не блок', () => {
    expect(
      startErrorBlock(new ApiError('Doctor not available', 400)),
    ).toBeNull();
    expect(startErrorBlock(new ApiError('x', 400, 'other'))).toBeNull();
  });

  it('не ApiError — не блок', () => {
    expect(startErrorBlock(new Error('device_limit'))).toBeNull();
    expect(startErrorBlock({ code: 'device_limit' })).toBeNull();
    expect(startErrorBlock(null)).toBeNull();
  });
});

describe('doctorFullName', () => {
  it('фамилия, имя, отчество', () => {
    expect(doctorFullName(doctors[0])).toBe('Алексеев Николай Петрович');
  });

  it('без отчества', () => {
    expect(doctorFullName(makeDoctor('4', 'Орлов', 'Дмитрий', null, []))).toBe(
      'Орлов Дмитрий',
    );
  });

  it('всё пусто — пустая строка', () => {
    expect(
      doctorFullName({
        ...doctors[0],
        first_name: null,
        last_name: null,
        middle_name: '  ',
      }),
    ).toBe('');
  });
});

describe('doctorSpecializationNames', () => {
  it('названия специализаций', () => {
    expect(doctorSpecializationNames(doctors[1])).toEqual([
      'Кардиолог',
      'Хирург',
    ]);
  });
});

describe('filterDoctors', () => {
  it('без фильтров возвращает всех', () => {
    expect(filterDoctors(doctors, '', '')).toHaveLength(3);
  });

  it('ищет по ФИО без учёта регистра и лишних пробелов', () => {
    expect(filterDoctors(doctors, 'алексеев', '')).toHaveLength(1);
    expect(filterDoctors(doctors, '  НИКОЛАЙ  ', '')).toHaveLength(1);
  });

  it('фильтрует по названию специализации', () => {
    expect(filterDoctors(doctors, '', 'Кардиолог')).toHaveLength(2);
    expect(filterDoctors(doctors, '', 'Хирург')).toHaveLength(1);
  });

  it('применяет поиск и фильтр совместно', () => {
    expect(filterDoctors(doctors, 'никитин', 'Кардиолог')).toHaveLength(1);
    expect(filterDoctors(doctors, 'никитин', 'Терапевт')).toHaveLength(0);
  });
});

describe('collectSpecializations', () => {
  it('собирает уникальные названия по алфавиту', () => {
    expect(collectSpecializations(doctors)).toEqual([
      'Кардиолог',
      'Терапевт',
      'Хирург',
    ]);
  });
});

describe('parseDoctorOptions', () => {
  it('разбирает врачей шага choose_doctor', () => {
    const [doctor] = parseDoctorOptions([
      {
        membership_id: 'm-1',
        public_slug: 'ivanov',
        photo_url: '/profile.svg',
        first_name: 'Иван',
        last_name: 'Иванов',
        middle_name: null,
        specializations: [{ id: 1, code: 'ther', name: 'Терапевт' }],
      },
    ]);

    expect(doctor).toEqual({
      membership_id: 'm-1',
      public_slug: 'ivanov',
      photo_url: '/profile.svg',
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: null,
      specializations: [{ id: 1, code: 'ther', name: 'Терапевт' }],
    });
  });

  it('отбрасывает элементы без идентификатора и не объекты', () => {
    expect(
      parseDoctorOptions([
        { first_name: 'Без идентификатора' },
        { membership_id: '' },
        { membership_id: 42 },
        'm-1',
        null,
        [],
        { membership_id: 'm-2' },
      ]).map((doctor) => doctor.membership_id),
    ).toEqual(['m-2']);
  });

  it('нечисловые поля и битые специализации становятся пустыми', () => {
    const [doctor] = parseDoctorOptions([
      {
        membership_id: 'm-1',
        first_name: 7,
        specializations: 'Терапевт',
      },
    ]);

    expect(doctor.first_name).toBeNull();
    expect(doctor.specializations).toEqual([]);
  });

  it('не массив — пустой список', () => {
    expect(parseDoctorOptions(null)).toEqual([]);
  });
});

describe('parseSpecializationOptions', () => {
  it('разбирает корректные элементы', () => {
    expect(
      parseSpecializationOptions([
        { id: 7, code: 'cardio', name: 'Кардиолог' },
      ]),
    ).toEqual([{ id: 7, code: 'cardio', name: 'Кардиолог' }]);
  });

  it('отбрасывает элементы без числового id или названия и не объекты', () => {
    expect(
      parseSpecializationOptions([
        { id: '7', name: 'Кардиолог' },
        { id: 8 },
        { id: 9, name: '' },
        'Терапевт',
        null,
        { id: 10, name: 'Хирург' },
      ]),
    ).toEqual([{ id: 10, code: null, name: 'Хирург' }]);
  });
});

describe('screenForStep', () => {
  it('выбор врача', () => {
    expect(screenForStep(steps.chooseDoctor)).toBe('doctor');
  });

  it('вопросы — в чате', () => {
    for (const step of [
      steps.chooseSpecialization,
      steps.visitType,
      steps.complaint,
      steps.aiClarify,
      steps.medications,
      makeStep({ step_key: 'chronic', step_type: 'text_or_none' }),
      makeStep({ step_key: 'allergy', step_type: 'text_or_none' }),
      steps.repeatChange,
      steps.repeatCompliance,
      steps.repeatSideEffects,
    ]) {
      expect(screenForStep(step)).toBe('chat');
    }
  });

  it('данные приёма', () => {
    expect(screenForStep(steps.patientInfo)).toBe('patient_info');
  });

  it('код — по ключу и по признаку завершения', () => {
    expect(screenForStep(steps.code)).toBe('code');
    expect(
      screenForStep(makeStep({ step_key: 'complaint', completed: true })),
    ).toBe('code');
  });

  it('неизвестный шаг — вопрос в чате', () => {
    expect(
      screenForStep(makeStep({ step_key: 'new_step', step_type: 'new_type' })),
    ).toBe('chat');
  });
});

describe('isSameStep', () => {
  const clarify = (text: string | null) =>
    makeStep({ step_key: 'ai_clarify', step_type: 'ai_question', text });

  it('тот же шаг с тем же вопросом', () => {
    expect(isSameStep(clarify('Как давно?'), clarify('Как давно?'))).toBe(true);
  });

  it('уточнения ИИ подряд различаются текстом вопроса', () => {
    expect(isSameStep(clarify('Как давно?'), clarify('Что усиливает?'))).toBe(
      false,
    );
  });

  it('другой шаг — не тот же', () => {
    expect(
      isSameStep(
        clarify('Как давно?'),
        makeStep({ step_key: 'medications', step_type: 'text_or_none' }),
      ),
    ).toBe(false);
  });

  it('пустой текст и null — одно и то же', () => {
    expect(isSameStep(clarify(null), clarify(''))).toBe(true);
  });
});

describe('chatPrompt', () => {
  it('выбор специализации — чипы специализаций, поле заблокировано', () => {
    expect(chatPrompt(steps.chooseSpecialization)).toEqual({
      stepKey: 'choose_specialization',
      text: 'К какому специалисту вы записаны?',
      chips: [
        { kind: 'specialization', id: 7, label: 'Кардиолог' },
        { kind: 'specialization', id: 9, label: 'Терапевт' },
      ],
      input: 'locked',
    });
  });

  it('тип приёма — своя подпись вопроса, чипы, поле заблокировано', () => {
    expect(chatPrompt(steps.visitType)).toEqual({
      stepKey: 'visit_type',
      text: VISIT_TYPE_QUESTION,
      chips: [
        { kind: 'choice', value: 'primary', label: 'Первичный' },
        { kind: 'choice', value: 'repeat', label: 'Повторный' },
      ],
      input: 'locked',
    });
  });

  it('выполнение назначений — чипы, поле заблокировано', () => {
    const prompt = chatPrompt(steps.repeatCompliance);

    expect(prompt.text).toBe('Выполняли ли назначения врача?');
    expect(prompt.chips.map((chip) => chip.kind)).toEqual([
      'choice',
      'choice',
      'choice',
    ]);
    expect(prompt.input).toBe('locked');
  });

  it('что изменилось — выбор варианта, текст с выбором', () => {
    const prompt = chatPrompt(steps.repeatChange);

    expect(prompt.text).toBe('Что изменилось после прошлого приёма?');
    expect(prompt.chips).toEqual([
      { kind: 'select', value: 'better', label: 'Лучше' },
      { kind: 'select', value: 'worse', label: 'Хуже' },
      { kind: 'select', value: 'same', label: 'Без изменений' },
    ]);
    expect(prompt.input).toBe('with_choice');
  });

  it('жалоба — только текст', () => {
    expect(chatPrompt(steps.complaint)).toEqual({
      stepKey: 'complaint',
      text: 'Что вас беспокоит?',
      chips: [],
      input: 'text',
    });
  });

  it('вопрос с ответом «Нет» — чип «Нет» и текст', () => {
    expect(chatPrompt(steps.medications)).toEqual({
      stepKey: 'medications',
      text: 'Принимаете ли сейчас какие-то лекарства? Какие?',
      chips: [{ kind: 'none', label: 'Нет' }],
      input: 'text',
    });
    expect(chatPrompt(steps.repeatSideEffects).chips).toEqual([
      { kind: 'none', label: 'Нет' },
    ]);
  });

  it('уточнение ИИ — текст без пропуска', () => {
    expect(chatPrompt(steps.aiClarify)).toEqual({
      stepKey: 'ai_clarify',
      text: 'Как давно это началось?',
      chips: [],
      input: 'text',
    });
  });

  it('неизвестный шаг — текст или заголовок и поле ввода', () => {
    expect(
      chatPrompt(
        makeStep({ step_key: 'new', step_type: 'new', title: 'Вопрос' }),
      ),
    ).toEqual({ stepKey: 'new', text: 'Вопрос', chips: [], input: 'text' });
  });
});

describe('buildAnswer', () => {
  it('текст', () => {
    expect(
      buildAnswer(steps.complaint, { type: 'text', text: '  болит голова ' }),
    ).toEqual({ step_key: 'complaint', value: 'болит голова' });
  });

  it('вариант', () => {
    expect(
      buildAnswer(steps.visitType, { type: 'choice', value: 'repeat' }),
    ).toEqual({ step_key: 'visit_type', choice: 'repeat' });
  });

  it('вариант с комментарием и без', () => {
    expect(
      buildAnswer(steps.repeatChange, {
        type: 'choice_text',
        value: 'better',
        text: ' меньше болит ',
      }),
    ).toEqual({
      step_key: 'repeat_change',
      choice: 'better',
      value: 'меньше болит',
    });
    expect(
      buildAnswer(steps.repeatChange, {
        type: 'choice_text',
        value: 'same',
        text: '   ',
      }),
    ).toEqual({ step_key: 'repeat_change', choice: 'same' });
  });

  it('«Нет»', () => {
    expect(buildAnswer(steps.medications, { type: 'none' })).toEqual({
      step_key: 'medications',
      none: true,
    });
  });

  it('специализация', () => {
    expect(
      buildAnswer(steps.chooseSpecialization, {
        type: 'specialization',
        id: 9,
      }),
    ).toEqual({ step_key: 'choose_specialization', specialization_id: 9 });
  });

  it('врач', () => {
    expect(
      buildAnswer(steps.chooseDoctor, { type: 'doctor', membershipId: 'm-1' }),
    ).toEqual({ step_key: 'choose_doctor', doctor_membership_id: 'm-1' });
  });

  it('данные приёма с отчеством и без', () => {
    expect(
      buildAnswer(steps.patientInfo, {
        type: 'patient_info',
        firstName: ' Анна ',
        middleName: ' Сергеевна ',
        date: '2026-10-01',
        time: '09:30',
      }),
    ).toEqual({
      step_key: 'patient_info',
      first_name: 'Анна',
      middle_name: 'Сергеевна',
      appointment_date: '2026-10-01',
      appointment_time: '09:30',
    });
    expect(
      buildAnswer(steps.patientInfo, {
        type: 'patient_info',
        firstName: 'Анна',
        middleName: '  ',
        date: '2026-10-01',
        time: '09:30',
      }),
    ).toEqual({
      step_key: 'patient_info',
      first_name: 'Анна',
      appointment_date: '2026-10-01',
      appointment_time: '09:30',
    });
  });
});

describe('patientReplyText', () => {
  it('текст, подпись варианта, «Нет», специализация', () => {
    expect(
      patientReplyText(chatPrompt(steps.complaint), {
        type: 'text',
        text: ' болит ',
      }),
    ).toBe('болит');
    expect(
      patientReplyText(chatPrompt(steps.visitType), {
        type: 'choice',
        value: 'repeat',
      }),
    ).toBe('Повторный');
    expect(
      patientReplyText(chatPrompt(steps.medications), { type: 'none' }),
    ).toBe('Нет');
    expect(
      patientReplyText(chatPrompt(steps.chooseSpecialization), {
        type: 'specialization',
        id: 7,
      }),
    ).toBe('Кардиолог');
  });

  it('вариант с комментарием', () => {
    const prompt = chatPrompt(steps.repeatChange);

    expect(
      patientReplyText(prompt, {
        type: 'choice_text',
        value: 'better',
        text: 'меньше болит',
      }),
    ).toBe('Лучше. меньше болит');
    expect(
      patientReplyText(prompt, {
        type: 'choice_text',
        value: 'worse',
        text: '',
      }),
    ).toBe('Хуже');
  });
});

describe('isDateInRange', () => {
  it('границы включительно', () => {
    expect(isDateInRange('2026-09-28', '2026-09-28', '2026-10-28')).toBe(true);
    expect(isDateInRange('2026-10-28', '2026-09-28', '2026-10-28')).toBe(true);
  });

  it('вне границ', () => {
    expect(isDateInRange('2026-09-27', '2026-09-28', '2026-10-28')).toBe(false);
    expect(isDateInRange('2026-10-29', '2026-09-28', '2026-10-28')).toBe(false);
  });

  it('пустое значение', () => {
    expect(isDateInRange('', '2026-09-28', '2026-10-28')).toBe(false);
  });

  it('без границ — без ограничения', () => {
    expect(isDateInRange('2030-01-01', null, null)).toBe(true);
  });
});

describe('время приёма', () => {
  it('колёса: все часы суток и все минуты часа', () => {
    expect(TIME_HOURS).toHaveLength(24);
    expect(TIME_HOURS[0]).toBe('00');
    expect(TIME_HOURS[23]).toBe('23');
    expect(TIME_MINUTES).toHaveLength(60);
    expect(TIME_MINUTES[0]).toBe('00');
    expect(TIME_MINUTES[59]).toBe('59');
  });

  it('любое сочетание значений колёс проходит проверку', () => {
    for (const hour of TIME_HOURS) {
      for (const minute of TIME_MINUTES) {
        expect(isAppointmentTime(`${hour}:${minute}`)).toBe(true);
      }
    }
  });

  it('границы суток и время вне прежних слотов', () => {
    expect(isAppointmentTime('00:00')).toBe(true);
    expect(isAppointmentTime('23:59')).toBe(true);
    expect(isAppointmentTime('08:15')).toBe(true);
    expect(isAppointmentTime('19:40')).toBe(true);
  });

  it('то, что backend отклонит', () => {
    expect(isAppointmentTime('')).toBe(false);
    expect(isAppointmentTime('24:00')).toBe(false);
    expect(isAppointmentTime('12:60')).toBe(false);
    expect(isAppointmentTime('9:00')).toBe(false);
    expect(isAppointmentTime('09:5')).toBe(false);
    expect(isAppointmentTime(' 09:00')).toBe(false);
    expect(isAppointmentTime('09:00 ')).toBe(false);
    expect(isAppointmentTime('09:00:00')).toBe(false);
    expect(isAppointmentTime('утро')).toBe(false);
  });

  it('разбор выбранного времени на часы и минуты', () => {
    expect(splitAppointmentTime('09:30')).toEqual({ hour: '09', minute: '30' });
    expect(splitAppointmentTime('23:59')).toEqual({ hour: '23', minute: '59' });
  });

  it('время не выбрано или некорректно — полдень', () => {
    expect(splitAppointmentTime('')).toEqual({ hour: '12', minute: '00' });
    expect(splitAppointmentTime('25:00')).toEqual({ hour: '12', minute: '00' });
    expect(splitAppointmentTime('9:00')).toEqual({ hour: '12', minute: '00' });
  });
});

describe('clampAnswer', () => {
  it('не трогает ответ в пределах лимита', () => {
    expect(clampAnswer('боль в спине')).toEqual({
      value: 'боль в спине',
      truncated: false,
    });
  });

  it('обрезает длинный ответ и сообщает об этом', () => {
    const result = clampAnswer('a'.repeat(ANSWER_MAX_LENGTH + 50));
    expect(result.value).toHaveLength(ANSWER_MAX_LENGTH);
    expect(result.truncated).toBe(true);
  });
});

describe('isValidPatientName', () => {
  it('требует непустое имя', () => {
    expect(isValidPatientName('Анна')).toBe(true);
    expect(isValidPatientName('   ')).toBe(false);
    expect(isValidPatientName('')).toBe(false);
  });
});

describe('estimateProgress', () => {
  it('растёт с числом ответов', () => {
    expect(estimateProgress(0, false)).toBe(0);
    expect(estimateProgress(4, false)).toBe(0.5);
  });

  it('до завершения не доходит до единицы', () => {
    expect(estimateProgress(8, false)).toBe(0.95);
    expect(estimateProgress(20, false)).toBe(0.95);
  });

  it('на завершении даёт единицу', () => {
    expect(estimateProgress(5, true)).toBe(1);
  });
});
