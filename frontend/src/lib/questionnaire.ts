// Чистая логика анкеты пациента: всё, что можно проверить без браузера.

import type {
  QuestionnaireDoctor,
  QuestionnaireLink,
  QuestionnaireState,
} from '@/api';

/** Предел длины ответа из ТЗ. Жёсткий лимит держит сервер, здесь — подсказка. */
export const ANSWER_MAX_LENGTH = 1000;

/** Насколько вперёд можно записаться, в днях. */
export const APPOINTMENT_DAYS_AHEAD = 30;

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Врачи по строке поиска и специализации. Фильтры применяются совместно:
 * пустая строка и пустая специализация означают «не фильтровать».
 */
export const filterDoctors = (
  doctors: QuestionnaireDoctor[],
  query: string,
  specialization: string,
): QuestionnaireDoctor[] => {
  const needle = normalize(query);
  const spec = specialization.trim();

  return doctors.filter((doctor) => {
    const matchesQuery =
      needle === '' || normalize(doctor.full_name).includes(needle);
    const matchesSpec = spec === '' || doctor.specializations.includes(spec);

    return matchesQuery && matchesSpec;
  });
};

/**
 * Специализации из карточек врачей. Запасной источник для фильтра: основной —
 * список с сервера, он задаёт единый порядок и справочник.
 */
export const collectSpecializations = (
  doctors: QuestionnaireDoctor[],
): string[] =>
  Array.from(new Set(doctors.flatMap((doctor) => doctor.specializations))).sort(
    (a, b) => a.localeCompare(b, 'ru'),
  );

/** Дата в формате YYYY-MM-DD по локальному времени, без сдвига часового пояса. */
export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/** Границы выбора даты приёма: от сегодня до +30 дней включительно. */
export const appointmentDateRange = (
  today: Date = new Date(),
): { min: string; max: string } => {
  const max = new Date(today);
  max.setDate(max.getDate() + APPOINTMENT_DAYS_AHEAD);

  return { min: toDateInputValue(today), max: toDateInputValue(max) };
};

/** Выбрана ли дата в допустимом диапазоне. */
export const isDateWithinRange = (
  value: string,
  today: Date = new Date(),
): boolean => {
  if (!value) return false;

  const { min, max } = appointmentDateRange(today);
  return value >= min && value <= max;
};

/**
 * Сетка времени приёма. Временное умолчание: ТЗ говорит «выбор из списка»,
 * но откуда берётся список — вопрос к смежникам (ВЗ-5). Когда сервер начнёт
 * отдавать слоты, эта функция уйдёт.
 */
export const appointmentTimeSlots = (): string[] => {
  const slots: string[] = [];

  for (let hour = 8; hour <= 20; hour += 1) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    if (hour !== 20) {
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
  }

  return slots;
};

export interface ClampedAnswer {
  value: string;
  truncated: boolean;
}

/** Обрезка ответа до предела с признаком, что обрезка произошла. */
export const clampAnswer = (text: string): ClampedAnswer => {
  if (text.length <= ANSWER_MAX_LENGTH) {
    return { value: text, truncated: false };
  }

  return { value: text.slice(0, ANSWER_MAX_LENGTH), truncated: true };
};

/**
 * Имя заполнено. Отчество не проверяется: оно есть не у всех, а обязательность
 * ещё не подтверждена смежниками (ВЗ-5).
 */
export const isValidPatientName = (value: string): boolean =>
  value.trim().length > 0;

/**
 * Ожидаемое число вопросов. Только для запасной оценки прогресса: настоящее
 * число зависит от того, сколько уточняющих задаст ИИ, и заранее не известно.
 */
const EXPECTED_QUESTIONS = 8;

/**
 * Запасная оценка прогресса, когда сервер не прислал `progress`.
 *
 * До завершения не доходит до единицы: показать пациенту «100 %» и задать
 * ещё вопрос — хуже, чем немного занизить.
 */
export const estimateProgress = (
  answered: number,
  finished: boolean,
): number => {
  if (finished) return 1;

  return Math.min(0.95, answered / EXPECTED_QUESTIONS);
};

/** Состояния, при которых вместо анкеты показывается экран-заглушка. */
export const isTerminalState = (state: QuestionnaireState): boolean =>
  state !== 'ok';

/**
 * Нужно ли загружать список врачей.
 *
 * Эндпоинт публичный и попадает под лимиты обращений из ТЗ, поэтому запрос
 * делается только там, где список действительно показывается: на экране
 * выбора врача и в заглушке деактивированного врача, где ТЗ требует
 * предложить другого. По ссылке врача и при прочих терминальных состояниях
 * список не нужен.
 */
export const needsDoctorList = (
  link: QuestionnaireLink | null,
  isPickerStep: boolean,
): boolean => {
  if (isPickerStep) return true;
  // Брендинг не загрузился: впереди всё равно экран выбора врача.
  if (!link) return true;
  if (link.state === 'doctor_inactive') return true;
  if (isTerminalState(link.state)) return false;

  return link.doctor === null;
};
