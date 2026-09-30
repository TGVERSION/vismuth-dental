// Чистая логика раздела «Анкеты» у врача: всё, что можно проверить без
// браузера.

import type {
  DoctorQuestionnaireDetail,
  DoctorQuestionnaireListItem,
  DoctorQuestionnaireQuery,
  QuestionnaireProcessingStatus,
  QuestionnaireVisitType,
} from '@/api';
import { APPOINTMENT_DAYS_AHEAD, toDateInputValue } from './questionnaire';

/**
 * Сколько дней backend хранит анкеты (`QUESTIONNAIRE_RETENTION_DAYS`).
 * Раньше этой даты в календаре выбирать нечего.
 */
export const QUESTIONNAIRE_RETENTION_DAYS = 45;

// --- Фильтры списка -------------------------------------------------------

const CODE_PATTERN = /^\d{4}$/;

export interface SearchQuery {
  code?: string;
  name?: string;
}

/**
 * Что ввёл врач: код пациента или имя.
 *
 * Ровно четыре цифры — код: другой длины backend отклоняет с 422. Всё прочее —
 * имя, причём только первое слово: сервер ищет подстроку в имени и в отчестве
 * по отдельности, и «Анна Петровна» целиком не нашлась бы ни там, ни там.
 */
export const parseSearchQuery = (raw: string): SearchQuery => {
  const value = raw.trim();
  if (!value) return {};
  if (CODE_PATTERN.test(value)) return { code: value };

  const [firstWord] = value.split(/\s+/);
  return { name: firstWord };
};

export interface QuestionnaireListFilters {
  search: string;
  /** YYYY-MM-DD, пустой не бывает. */
  date: string;
  /** Пустая строка — без фильтра по типу. */
  visitType: QuestionnaireVisitType | '';
}

/**
 * Параметры запроса списка.
 *
 * Дата уходит всегда: без неё сервер подставит «сегодня» в своём часовом
 * поясе, а не в поясе врача. Поэтому и код ищется в пределах выбранного дня.
 */
export const buildListQuery = ({
  search,
  date,
  visitType,
}: QuestionnaireListFilters): DoctorQuestionnaireQuery => ({
  date,
  ...parseSearchQuery(search),
  ...(visitType ? { visit_type: visitType } : {}),
});

/**
 * Показывать ли анкету в списке.
 *
 * Врач не должен видеть анкету, пока её не обработал ИИ. Сейчас backend
 * статус в списке не присылает (ВЗ-6) — тогда показываем всё, отличить нечего.
 * Как только поле появится, необработанные скроются без правки фронтенда.
 */
export const isVisibleInList = (
  item: Pick<DoctorQuestionnaireListItem, 'processing_status'>,
): boolean =>
  item.processing_status === undefined || item.processing_status === 'done';

/** Анкета обработана и её разделы можно показывать. */
export const isQuestionnaireReady = (
  detail: Pick<DoctorQuestionnaireDetail, 'processing_status' | 'structured'>,
): boolean => detail.processing_status === 'done' && detail.structured !== null;

/** Строка вместо разделов, пока анкета не обработана. */
export const notReadyMessage = (
  status: QuestionnaireProcessingStatus | null,
): string =>
  status === 'pending'
    ? 'Анкета обрабатывается. Откройте её чуть позже.'
    : 'Анкета не обработана.';

/**
 * Границы календаря: от срока хранения анкет в прошлом до горизонта записи
 * в будущем.
 */
export const doctorDateRange = (
  today: Date = new Date(),
): { min: string; max: string } => {
  const min = new Date(today);
  min.setDate(min.getDate() - QUESTIONNAIRE_RETENTION_DAYS);

  const max = new Date(today);
  max.setDate(max.getDate() + APPOINTMENT_DAYS_AHEAD);

  return { min: toDateInputValue(min), max: toDateInputValue(max) };
};

// --- Строка списка --------------------------------------------------------

const TIME_PATTERN = /^(\d{1,2}):(\d{2})/;

/** Минуты от начала суток или `null`, если время не разобрать. */
const minutesOf = (time: string | null): number | null => {
  const match = time ? TIME_PATTERN.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Время приёма для показа: «09:00», а без времени — «—». */
export const formatAppointmentTime = (time: string | null): string => {
  const minutes = minutesOf(time);
  if (minutes === null) return '—';

  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const rest = String(minutes % 60).padStart(2, '0');
  return `${hours}:${rest}`;
};

/**
 * По времени приёма, анкеты без времени — в конце. Сервер уже сортирует так
 * же; здесь порядок страхуется, чтобы не зависеть от сервера.
 */
export const sortByTime = <
  T extends Pick<DoctorQuestionnaireListItem, 'appointment_time'>,
>(
  items: T[],
): T[] =>
  [...items].sort((a, b) => {
    const left = minutesOf(a.appointment_time);
    const right = minutesOf(b.appointment_time);

    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
  });

/**
 * Приём уже наступил. Ровно наступившая минута — уже прошла. Без даты или
 * времени — `false`: не приглушаем то, о чём ничего не известно.
 */
export const isAppointmentPast = (
  item: Pick<
    DoctorQuestionnaireListItem,
    'appointment_date' | 'appointment_time'
  >,
  now: Date,
): boolean => {
  const minutes = minutesOf(item.appointment_time);
  if (!item.appointment_date || minutes === null) return false;

  const [year, month, day] = item.appointment_date.split('-').map(Number);
  if (!year || !month || !day) return false;

  const moment = new Date(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
  );
  return moment.getTime() <= now.getTime();
};

const VISIT_TYPE_LABELS: Record<QuestionnaireVisitType, string> = {
  primary: 'Первичный',
  repeat: 'Повторный',
};

export const VISIT_TYPES: QuestionnaireVisitType[] = ['primary', 'repeat'];

export const isVisitType = (value: unknown): value is QuestionnaireVisitType =>
  value === 'primary' || value === 'repeat';

/** Подпись типа приёма; неизвестное значение — `null`. */
export const visitTypeLabel = (value: string | null): string | null =>
  isVisitType(value) ? VISIT_TYPE_LABELS[value] : null;

/** Имя и отчество пациента одной строкой; пустая строка, если их нет. */
export const patientName = (
  item: Pick<
    DoctorQuestionnaireListItem,
    'patient_first_name' | 'patient_middle_name'
  >,
): string =>
  [item.patient_first_name, item.patient_middle_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

// --- Разделы анкеты -------------------------------------------------------

export type QuestionnaireSectionKey =
  | 'complaints'
  | 'life_anamnesis'
  | 'allergy_anamnesis'
  | 'medications';

/** Разделы карточки в порядке макета. */
export const QUESTIONNAIRE_SECTIONS: {
  key: QuestionnaireSectionKey;
  title: string;
}[] = [
  { key: 'complaints', title: 'Жалобы' },
  { key: 'life_anamnesis', title: 'Анамнез жизни' },
  { key: 'allergy_anamnesis', title: 'Аллергологический анамнез' },
  { key: 'medications', title: 'Принимаемые препараты' },
];

const isSectionKey = (value: unknown): value is QuestionnaireSectionKey =>
  QUESTIONNAIRE_SECTIONS.some((section) => section.key === value);

/**
 * «Что доспросить» по разделам.
 *
 * Формат `gaps` в контракте не описан (ВЗ-1). Принимаются элементы
 * `{ section, question }` с известным разделом и непустым вопросом — это
 * формат, предложенный смежникам. Всё остальное отбрасывается: без привязки
 * к разделу блок показать негде.
 */
export const parseGaps = (
  gaps: unknown[] | null | undefined,
): Record<QuestionnaireSectionKey, string[]> => {
  const result: Record<QuestionnaireSectionKey, string[]> = {
    complaints: [],
    life_anamnesis: [],
    allergy_anamnesis: [],
    medications: [],
  };
  if (!Array.isArray(gaps)) return result;

  for (const gap of gaps) {
    if (typeof gap !== 'object' || gap === null) continue;

    const { section, question } = gap as Record<string, unknown>;
    if (!isSectionKey(section) || typeof question !== 'string') continue;

    const text = question.trim();
    if (text) result[section].push(text);
  }

  return result;
};

export interface QuestionnaireSectionView {
  key: QuestionnaireSectionKey;
  title: string;
  text: string;
  /** Текста нет — в карточке «Пациент не ответил». */
  isEmpty: boolean;
  gaps: string[];
}

/** Разделы карточки с текстом и вопросами «что доспросить». */
export const buildSections = (
  detail: Pick<DoctorQuestionnaireDetail, 'structured' | 'gaps'>,
): QuestionnaireSectionView[] => {
  const gaps = parseGaps(detail.gaps);

  return QUESTIONNAIRE_SECTIONS.map(({ key, title }) => {
    const raw = detail.structured?.[key];
    const text = typeof raw === 'string' ? raw.trim() : '';

    return { key, title, text, isEmpty: text === '', gaps: gaps[key] };
  });
};
