import { describe, expect, it } from 'vitest';
import type {
  QuestionnaireDoctor,
  QuestionnaireLink,
  QuestionnaireState,
} from '@/api';
import {
  ANSWER_MAX_LENGTH,
  appointmentDateRange,
  clampAnswer,
  collectSpecializations,
  estimateProgress,
  filterDoctors,
  isDateWithinRange,
  isTerminalState,
  isValidPatientName,
  needsDoctorList,
} from './questionnaire';

const doctors: QuestionnaireDoctor[] = [
  {
    id: '1',
    full_name: 'Алексеев Николай Петрович',
    photo_url: null,
    specializations: ['Кардиолог', 'Терапевт'],
  },
  {
    id: '2',
    full_name: 'Никитин Фёдор Николаевич',
    photo_url: null,
    specializations: ['Кардиолог', 'Хирург'],
  },
  {
    id: '3',
    full_name: 'Егорова Светлана Ивановна',
    photo_url: null,
    specializations: ['Терапевт'],
  },
];

describe('filterDoctors', () => {
  it('без фильтров возвращает всех', () => {
    expect(filterDoctors(doctors, '', '')).toHaveLength(3);
  });

  it('ищет по ФИО без учёта регистра и лишних пробелов', () => {
    expect(filterDoctors(doctors, 'алексеев', '')).toHaveLength(1);
    expect(filterDoctors(doctors, '  НИКОЛАЙ  ', '')).toHaveLength(1);
  });

  it('фильтрует по специализации', () => {
    expect(filterDoctors(doctors, '', 'Кардиолог')).toHaveLength(2);
    expect(filterDoctors(doctors, '', 'Хирург')).toHaveLength(1);
  });

  it('применяет поиск и фильтр совместно', () => {
    expect(filterDoctors(doctors, 'никитин', 'Кардиолог')).toHaveLength(1);
    // Никитин кардиолог и хирург, но не терапевт — совместный фильтр пуст.
    expect(filterDoctors(doctors, 'никитин', 'Терапевт')).toHaveLength(0);
  });

  it('возвращает пустой список, когда совпадений нет', () => {
    expect(filterDoctors(doctors, 'несуществующий', '')).toEqual([]);
  });
});

describe('collectSpecializations', () => {
  it('собирает уникальные специализации по алфавиту', () => {
    expect(collectSpecializations(doctors)).toEqual([
      'Кардиолог',
      'Терапевт',
      'Хирург',
    ]);
  });
});

describe('appointmentDateRange', () => {
  it('даёт диапазон от сегодня до +30 дней', () => {
    const today = new Date(2026, 8, 21);
    expect(appointmentDateRange(today)).toEqual({
      min: '2026-09-21',
      max: '2026-10-21',
    });
  });

  it('корректно переходит через границу года', () => {
    const today = new Date(2026, 11, 20);
    expect(appointmentDateRange(today).max).toBe('2027-01-19');
  });
});

describe('isDateWithinRange', () => {
  const today = new Date(2026, 8, 21);

  it('принимает сегодня и последний допустимый день', () => {
    expect(isDateWithinRange('2026-09-21', today)).toBe(true);
    expect(isDateWithinRange('2026-10-21', today)).toBe(true);
  });

  it('отклоняет вчера и день за границей', () => {
    expect(isDateWithinRange('2026-09-20', today)).toBe(false);
    expect(isDateWithinRange('2026-10-22', today)).toBe(false);
  });

  it('отклоняет пустое значение', () => {
    expect(isDateWithinRange('', today)).toBe(false);
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
    // Показать «100 %» и задать ещё вопрос — хуже, чем немного занизить.
    expect(estimateProgress(8, false)).toBe(0.95);
    expect(estimateProgress(20, false)).toBe(0.95);
  });

  it('на завершении даёт единицу', () => {
    expect(estimateProgress(5, true)).toBe(1);
  });
});

describe('needsDoctorList', () => {
  const makeLink = (
    state: QuestionnaireState,
    doctor: QuestionnaireDoctor | null,
  ): QuestionnaireLink => ({
    clinic: {
      name: 'Клиника',
      phone: '+7 900 000-00-00',
      logo_url: null,
      brand_color: null,
    },
    target: doctor ? 'doctor' : 'clinic',
    doctor,
    consent_required: false,
    state,
  });

  it('на экране выбора врача список нужен всегда', () => {
    expect(needsDoctorList(makeLink('ok', doctors[0]), true)).toBe(true);
    expect(needsDoctorList(null, true)).toBe(true);
  });

  it('по ссылке клиники список нужен: экран выбора впереди', () => {
    expect(needsDoctorList(makeLink('ok', null), false)).toBe(true);
  });

  it('по ссылке врача список не нужен: экран выбора пропускается', () => {
    expect(needsDoctorList(makeLink('ok', doctors[0]), false)).toBe(false);
  });

  it('при деактивированном враче список нужен: ТЗ требует предложить другого', () => {
    expect(
      needsDoctorList(makeLink('doctor_inactive', doctors[0]), false),
    ).toBe(true);
  });

  it('при прочих терминальных состояниях список не нужен', () => {
    // Показывается заглушка — запрос израсходовал бы лимит впустую.
    expect(needsDoctorList(makeLink('subscription_ended', null), false)).toBe(
      false,
    );
    expect(needsDoctorList(makeLink('clinic_limit', null), false)).toBe(false);
    expect(needsDoctorList(makeLink('device_limit', null), false)).toBe(false);
    expect(needsDoctorList(makeLink('ip_limit', null), false)).toBe(false);
  });

  it('без данных ссылки список нужен: впереди экран выбора', () => {
    expect(needsDoctorList(null, false)).toBe(true);
  });
});

describe('isTerminalState', () => {
  it('рабочее состояние не ведёт на заглушку', () => {
    expect(isTerminalState('ok')).toBe(false);
  });

  it('любое другое состояние ведёт на заглушку', () => {
    expect(isTerminalState('subscription_ended')).toBe(true);
    expect(isTerminalState('doctor_inactive')).toBe(true);
    expect(isTerminalState('device_limit')).toBe(true);
    expect(isTerminalState('ip_limit')).toBe(true);
    expect(isTerminalState('clinic_limit')).toBe(true);
  });
});
