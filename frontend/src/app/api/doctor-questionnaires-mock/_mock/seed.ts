// Демо-анкеты заглушки. Даты считаются относительно текущего дня на момент
// запроса: часть приёмов уже прошла, часть впереди, одна — через пару минут,
// чтобы увидеть, как строка приглушается без перезагрузки. Идентификаторы
// постоянные, поэтому ссылка `?id=` переживает смену суток.
//
// Тексты демонстрационные.

import type {
  DoctorQuestionnaireDetail,
  DoctorQuestionnaireListItem,
  QuestionnaireProcessingStatus,
} from '@/api';
import { toDateInputValue } from '@/lib/questionnaire';
import { getProtocolId } from './store';

interface SeedTemplate {
  id: string;
  /** Смещение дня приёма от сегодня. */
  dayOffset: number;
  /** HH:MM или `null` — время «через две минуты от сейчас». */
  time: string | null;
  code: string;
  firstName: string;
  middleName: string | null;
  visitType: 'primary' | 'repeat';
  status: QuestionnaireProcessingStatus;
  structured?: DoctorQuestionnaireDetail['structured'];
  gaps?: unknown[];
}

const LUMBAR = {
  complaints:
    'Боль в поясничной области, с иррадиацией в правую ногу, до 7 баллов. ' +
    'Слабость в ногах, ограничение самостоятельного передвижения. ' +
    'Периодически — отёки голеней.',
  life_anamnesis: 'Гипертоническая болезнь, остеохондроз поясничного отдела.',
  allergy_anamnesis:
    'Аллергия на пенициллин — крапивница. Пищевой аллергии нет.',
  medications:
    'Диклофенак 75 мг — 2 раза в день, 5 дней.\nОмепразол 20 мг — утром.',
};

const COLD = {
  complaints:
    'Заболел остро 4 дня назад: озноб, заложенность носа. ' +
    'Ухудшение вчера — усилился кашель.',
  life_anamnesis: 'Хронических заболеваний нет.',
  allergy_anamnesis: 'Не отмечает.',
  medications: 'Парацетамол 500 мг при температуре, с временным эффектом.',
};

const TEMPLATES: SeedTemplate[] = [
  {
    id: 'mock-q-01',
    dayOffset: 0,
    time: '09:00',
    code: '5860',
    firstName: 'Аполлинария',
    middleName: 'Варфоломеевна',
    visitType: 'primary',
    status: 'done',
    structured: LUMBAR,
    gaps: [
      { section: 'complaints', question: 'Как давно это началось?' },
      { section: 'complaints', question: 'Где именно болит?' },
      { section: 'complaints', question: 'Что усиливает, а что облегчает?' },
      {
        section: 'complaints',
        question:
          'Что ещё беспокоит вместе с этим: температура, тошнота, одышка?',
      },
      {
        section: 'allergy_anamnesis',
        question: 'Что уже пробовали, помогло ли?',
      },
      {
        section: 'life_anamnesis',
        question: 'Есть ли похожие болезни у родственников?',
      },
      {
        section: 'medications',
        question: 'Сколько миллиграммов и сколько раз в день?',
      },
      {
        section: 'medications',
        question: 'Как давно принимаете? Бывает, что пропускаете?',
      },
      {
        section: 'medications',
        question: 'Помогает ли? Были ли побочные эффекты?',
      },
    ],
  },
  {
    id: 'mock-q-02',
    dayOffset: 0,
    time: '09:30',
    code: '4568',
    firstName: 'Анастасия',
    middleName: 'Игоревна',
    visitType: 'primary',
    status: 'done',
    structured: COLD,
  },
  {
    id: 'mock-q-03',
    dayOffset: 0,
    time: '10:00',
    code: '9532',
    firstName: 'Максим',
    middleName: 'Александрович',
    visitType: 'primary',
    status: 'done',
    structured: COLD,
  },
  {
    id: 'mock-q-04',
    dayOffset: 0,
    time: '10:30',
    code: '7854',
    firstName: 'Александра',
    middleName: 'Николаевна',
    visitType: 'primary',
    status: 'done',
    structured: LUMBAR,
  },
  {
    id: 'mock-q-05',
    dayOffset: 0,
    time: '11:00',
    code: '1346',
    firstName: 'Николай',
    middleName: 'Петрович',
    visitType: 'primary',
    status: 'pending',
  },
  {
    id: 'mock-q-06',
    dayOffset: 0,
    time: '11:30',
    code: '9751',
    firstName: 'Пётр',
    middleName: null,
    visitType: 'repeat',
    status: 'done',
    // На повторном приёме аллергоанамнез не собирается.
    structured: {
      complaints: 'Боль в спине стала меньше, ходит самостоятельно.',
      allergy_anamnesis: '',
      medications: 'Диклофенак отменён. Омепразол 20 мг — утром.',
    },
  },
  {
    id: 'mock-q-07',
    dayOffset: 0,
    time: '12:00',
    code: '2203',
    firstName: 'Ольга',
    middleName: 'Сергеевна',
    visitType: 'primary',
    status: 'failed',
  },
  {
    id: 'mock-q-08',
    dayOffset: 0,
    time: null,
    code: '6410',
    firstName: 'Ирина',
    middleName: 'Павловна',
    visitType: 'repeat',
    status: 'done',
    structured: {
      complaints: 'Жалоб нет, пришла за результатами анализов.',
      allergy_anamnesis: '',
      medications: '',
    },
  },
  {
    // Тот же код, что у сегодняшней анкеты: код ищется только в выбранном дне.
    id: 'mock-q-09',
    dayOffset: -1,
    time: '10:00',
    code: '5860',
    firstName: 'Анна',
    middleName: 'Петровна',
    visitType: 'primary',
    status: 'done',
    structured: COLD,
  },
  {
    id: 'mock-q-10',
    dayOffset: 1,
    time: '09:00',
    code: '3321',
    firstName: 'Сергей',
    middleName: 'Викторович',
    visitType: 'repeat',
    status: 'done',
    structured: LUMBAR,
  },
];

const pad = (value: number): string => String(value).padStart(2, '0');

/** Время через две минуты от `now` — для проверки приглушения строки. */
const soonTime = (now: Date): string => {
  const soon = new Date(now.getTime() + 2 * 60_000);
  return `${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
};

const buildDetail = (
  template: SeedTemplate,
  now: Date,
): DoctorQuestionnaireDetail => {
  const day = new Date(now);
  day.setDate(day.getDate() + template.dayOffset);

  return {
    id: template.id,
    appointment_date: toDateInputValue(day),
    appointment_time: template.time ?? soonTime(now),
    patient_first_name: template.firstName,
    patient_middle_name: template.middleName,
    visit_type: template.visitType,
    specialization_name: 'Терапевт',
    code: template.code,
    protocol_id: getProtocolId(template.id),
    ai_unavailable: false,
    processing_status: template.status,
    structured: template.status === 'done' ? (template.structured ?? {}) : null,
    gaps: template.status === 'done' ? (template.gaps ?? []) : null,
    answers: [],
  };
};

export const seedQuestionnaires = (
  now: Date = new Date(),
): DoctorQuestionnaireDetail[] =>
  TEMPLATES.map((template) => buildDetail(template, now));

export const findQuestionnaire = (
  id: string,
  now: Date = new Date(),
): DoctorQuestionnaireDetail | null => {
  const template = TEMPLATES.find((item) => item.id === id);
  return template ? buildDetail(template, now) : null;
};

/**
 * Строка списка. `processing_status` есть только в режиме `status_field`:
 * текущий backend его в списке не присылает.
 */
export const toListItem = (
  detail: DoctorQuestionnaireDetail,
  withStatus: boolean,
): DoctorQuestionnaireListItem => ({
  id: detail.id,
  appointment_date: detail.appointment_date,
  completed_at: detail.appointment_date
    ? `${detail.appointment_date}T12:00:00Z`
    : null,
  appointment_time: detail.appointment_time,
  patient_first_name: detail.patient_first_name,
  patient_middle_name: detail.patient_middle_name,
  visit_type: detail.visit_type,
  specialization_name: detail.specialization_name,
  code: detail.code,
  protocol_id: detail.protocol_id,
  ...(withStatus ? { processing_status: detail.processing_status } : {}),
});
