// Чистая логика анкеты пациента: всё, что можно проверить без браузера.
//
// Сценарий анкеты ведёт backend (`services/questionnaire_flow.py`): он хранит
// текущий шаг и отдаёт его описание. Здесь — перевод описания шага в то, что
// показать пациенту, и ответа пациента — в тело запроса.
//
// Модуль импортирует и серверная заглушка анкет у врача, поэтому зависимости
// здесь только типовые: runtime-импорт `base-client` затянул бы authStore
// в серверный маршрут.

import type {
  PublicLink,
  PublicLinkDoctor,
  PublicSpecialization,
  QuestionnaireStep,
  QuestionnaireStepAnswer,
} from '@/api';

/** Предел длины ответа из ТЗ. Жёсткий лимит держит сервер, здесь — подсказка. */
export const ANSWER_MAX_LENGTH = 1000;

/** Насколько вперёд можно записаться, в днях. */
export const APPOINTMENT_DAYS_AHEAD = 30;

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

// ---------------------------------------------------------------------------
// Клиника и блокировки

/** Брендинг клиники — то, что экраны анкеты берут из ссылки. */
export interface ClinicBranding {
  name: string;
  phone: string | null;
  /** Недоверенный URL: перед отрисовкой проходит `sanitizeImageUrl`. */
  logo_url: string | null;
  /** Недоверенное значение: перед попаданием в CSS проходит проверку. */
  brand_color: string | null;
  button_color?: string | null;
}

/**
 * Брендинг из ссылки. Ссылка не загрузилась — нейтральная клиника: анкета
 * всё равно работает, просто без названия и фирменного цвета.
 */
export const clinicBranding = (link: PublicLink | null): ClinicBranding =>
  link
    ? {
        name: link.clinic_name,
        phone: link.phone,
        logo_url: link.logo_url,
        brand_color: link.brand_color,
        button_color: link.button_color,
      }
    : { name: 'Клиника', phone: null, logo_url: null, brand_color: null };

/** Почему вместо анкеты показывается экран-заглушка. */
export type QuestionnaireBlock =
  | 'subscription_expired'
  | 'clinic_daily_limit'
  | 'doctor_inactive'
  | 'device_limit'
  | 'ip_limit'
  // Стоматологическая клиника: анкета только по персональной ссылке.
  | 'invite_only'
  | 'invite_expired'
  | 'invite_not_found';

const BLOCKS: readonly QuestionnaireBlock[] = [
  'subscription_expired',
  'clinic_daily_limit',
  'doctor_inactive',
  'device_limit',
  'ip_limit',
  'invite_only',
  'invite_expired',
  'invite_not_found',
];

const toBlock = (code: unknown): QuestionnaireBlock | null =>
  typeof code === 'string' && (BLOCKS as readonly string[]).includes(code)
    ? (code as QuestionnaireBlock)
    : null;

/**
 * Блокировка ссылки. Неизвестный код при `blocked` — самый общий текст
 * «Сервис временно недоступен»: ссылка закрыта, а почему — фронтенд не знает.
 */
export const linkBlock = (
  link: PublicLink | null,
): QuestionnaireBlock | null => {
  if (!link?.blocked) return null;

  return toBlock(link.block_code) ?? 'subscription_expired';
};

/**
 * Блокировка по ошибке старта: код из `detail: { code, message }` backend
 * (429 device_limit / ip_limit, 503 subscription_expired / clinic_daily_limit,
 * 400 doctor_inactive). Прочие ошибки — не блокировка.
 *
 * Проверка по форме, а не `instanceof ApiError`: см. шапку модуля.
 */
export const startErrorBlock = (error: unknown): QuestionnaireBlock | null => {
  if (!(error instanceof Error) || error.name !== 'ApiError') return null;

  return toBlock((error as Error & { code?: unknown }).code);
};

// ---------------------------------------------------------------------------
// Врачи

/** «Фамилия Имя Отчество» без пустых частей. */
export const doctorFullName = (doctor: PublicLinkDoctor): string =>
  [doctor.last_name, doctor.first_name, doctor.middle_name]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

export const doctorSpecializationNames = (doctor: PublicLinkDoctor): string[] =>
  doctor.specializations.map((specialization) => specialization.name);

/**
 * Врачи по строке поиска и специализации. Фильтры применяются совместно:
 * пустая строка и пустая специализация означают «не фильтровать».
 */
export const filterDoctors = (
  doctors: PublicLinkDoctor[],
  query: string,
  specializationName: string,
): PublicLinkDoctor[] => {
  const needle = normalize(query);
  const spec = specializationName.trim();

  return doctors.filter((doctor) => {
    const matchesQuery =
      needle === '' ||
      normalize(doctorFullName(doctor)).includes(needle) ||
      doctorSpecializationNames(doctor).some((name) =>
        normalize(name).includes(needle),
      );
    const matchesSpec =
      spec === '' || doctorSpecializationNames(doctor).includes(spec);

    return matchesQuery && matchesSpec;
  });
};

/** Названия специализаций из карточек врачей — для фильтра, по алфавиту. */
export const collectSpecializations = (doctors: PublicLinkDoctor[]): string[] =>
  Array.from(new Set(doctors.flatMap(doctorSpecializationNames))).sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );

/**
 * Специализации из `options` шага `choose_specialization` или из карточки
 * врача. Элемент без числового `id` или строкового `name` отбрасывается:
 * выбрать его всё равно нельзя.
 */
export const parseSpecializationOptions = (
  options: unknown,
): PublicSpecialization[] => {
  if (!Array.isArray(options)) return [];

  return options.flatMap((item): PublicSpecialization[] => {
    if (!isRecord(item)) return [];
    const { id, name } = item;
    if (typeof id !== 'number' || !Number.isFinite(id)) return [];
    if (typeof name !== 'string' || name.trim() === '') return [];

    return [{ id, code: stringOrNull(item.code), name }];
  });
};

/**
 * Врачи из `options` шага `choose_doctor`. Элемент без `membership_id`
 * отбрасывается: выбор врача отправляет именно его.
 */
export const parseDoctorOptions = (options: unknown): PublicLinkDoctor[] => {
  if (!Array.isArray(options)) return [];

  return options.flatMap((item): PublicLinkDoctor[] => {
    if (!isRecord(item)) return [];
    const membershipId = item.membership_id;
    if (typeof membershipId !== 'string' || membershipId === '') return [];

    return [
      {
        membership_id: membershipId,
        public_slug: stringOrNull(item.public_slug),
        photo_url: stringOrNull(item.photo_url),
        first_name: stringOrNull(item.first_name),
        last_name: stringOrNull(item.last_name),
        middle_name: stringOrNull(item.middle_name),
        specializations: parseSpecializationOptions(item.specializations),
      },
    ];
  });
};

// ---------------------------------------------------------------------------
// Шаги анкеты

/** Какой экран показать на шаге сервера. */
export type QuestionnaireScreen =
  | 'doctor'
  | 'chat'
  | 'patient_info'
  | 'code'
  | 'stopped'
  | 'gastro';

/**
 * Экран по шагу. Всё, что не выбор врача, не данные приёма и не код, —
 * вопрос в чате, в том числе шаги, которых фронтенд ещё не знает: вопрос
 * с полем ввода лучше, чем пустой экран.
 */
export const screenForStep = (step: QuestionnaireStep): QuestionnaireScreen => {
  if (step.step_key === 'guard_stopped' || step.step_type === 'stopped') {
    return 'stopped';
  }
  if (step.completed || step.step_key === 'code' || step.step_type === 'code') {
    return 'code';
  }
  if (step.step_type === 'gastro_form' || step.step_key.startsWith('gastro_')) {
    return 'gastro';
  }
  if (step.step_key === 'choose_doctor' || step.step_type === 'choose_doctor') {
    return 'doctor';
  }
  if (step.step_key === 'patient_info' || step.step_type === 'patient_info') {
    return 'patient_info';
  }

  return 'chat';
};

/**
 * Тот же ли это вопрос. Одного `step_key` мало: уточнения ИИ идут шагом
 * `ai_clarify` подряд, различаются они только текстом — а подряд один и тот
 * же вопрос backend не задаёт (`is_ai_done_heuristic`).
 */
export const isSameStep = (
  a: QuestionnaireStep,
  b: QuestionnaireStep,
): boolean =>
  a.step_key === b.step_key &&
  a.step_type === b.step_type &&
  (a.text ?? '') === (b.text ?? '') &&
  (!a.step_key.startsWith('gastro_') ||
    JSON.stringify(a.gastro) === JSON.stringify(b.gastro));

/**
 * Вопрос о типе приёма. У backend на этом шаге только заголовок «Тип приёма»
 * — в пузыре чата это не вопрос. При смене сценария на сервере поправить.
 */
export const VISIT_TYPE_QUESTION = 'Вы на первичный или повторный приём?';

const SPECIALIZATION_QUESTION = 'К какому специалисту вы записаны?';

export const NONE_LABEL = 'Нет';

/** Подсказка под полем, когда ответить можно только вариантом. */
export const CHOOSE_OPTION_HINT = 'Выберите один из вариантов выше';

/** Подсказка под полем, когда текст — комментарий к варианту. */
export const COMMENT_WITH_CHOICE_HINT =
  'Выберите вариант выше. Комментарий из поля, если есть, отправится вместе с ним';

/** Быстрый ответ над полем ввода. Любой отправляется сразу по нажатию. */
export type ChatChip =
  | { kind: 'choice'; value: string; label: string }
  /** Вариант, к которому добавляется комментарий из поля, если он есть. */
  | { kind: 'select'; value: string; label: string }
  /** «Нет» на вопросах о лекарствах, болезнях, аллергии. */
  | { kind: 'none'; label: string }
  | { kind: 'specialization'; id: number; label: string };

/**
 * Поле ввода:
 * - `text` — обычный ответ текстом;
 * - `locked` — видно, но ответ только вариантом: backend текст на шаге
 *   не принимает (ВЗ-6);
 * - `with_choice` — текст необязательный: уходит комментарием вместе с
 *   нажатым вариантом, сам по себе не отправляется.
 */
export type ChatInputMode = 'text' | 'locked' | 'with_choice';

export interface ChatPrompt {
  stepKey: string;
  /** Текст пузыря ассистента. Пустая строка — пузырь не показывается. */
  text: string;
  chips: ChatChip[];
  input: ChatInputMode;
}

const stepText = (step: QuestionnaireStep): string =>
  step.text?.trim() || step.title?.trim() || '';

const choiceChips = (
  step: QuestionnaireStep,
  kind: 'choice' | 'select',
): ChatChip[] =>
  step.choices.map((choice) => ({
    kind,
    value: choice.value,
    label: choice.label,
  }));

/** Вопрос чата по шагу сервера: текст, быстрые ответы и режим поля ввода. */
export const chatPrompt = (step: QuestionnaireStep): ChatPrompt => {
  const stepKey = step.step_key;

  if (
    stepKey === 'choose_specialization' ||
    step.step_type === 'choose_specialization'
  ) {
    return {
      stepKey,
      text: stepText(step) || SPECIALIZATION_QUESTION,
      chips: parseSpecializationOptions(step.options).map((item) => ({
        kind: 'specialization',
        id: item.id,
        label: item.name,
      })),
      input: 'locked',
    };
  }

  if (stepKey === 'visit_type') {
    return {
      stepKey,
      text: VISIT_TYPE_QUESTION,
      chips: choiceChips(step, 'choice'),
      input: 'locked',
    };
  }

  if (step.step_type === 'choice') {
    return {
      stepKey,
      text: stepText(step),
      chips: choiceChips(step, 'choice'),
      input: 'locked',
    };
  }

  if (step.step_type === 'choice_text') {
    return {
      stepKey,
      text: stepText(step),
      chips: choiceChips(step, 'select'),
      input: 'with_choice',
    };
  }

  // `text`, `text_or_none`, `ai_question` и неизвестные типы — ответ текстом.
  // Пропуск на уточнениях ИИ не показывается (ТЗ 22.09.2026, решение 4).
  const chips = choiceChips(step, 'choice');
  if (step.step_type === 'text_or_none' || step.allow_none) {
    chips.push({ kind: 'none', label: NONE_LABEL });
  }

  return { stepKey, text: stepText(step), chips, input: 'text' };
};

/** Действие пациента в чате. */
export type ChatAction =
  | { type: 'text'; text: string }
  | { type: 'choice'; value: string }
  | { type: 'choice_text'; value: string; text: string }
  | { type: 'none' }
  | { type: 'specialization'; id: number };

/** Любое действие пациента, которое уходит ответом на шаг. */
export type QuestionnaireAction =
  | ChatAction
  | { type: 'doctor'; membershipId: string }
  | {
      type: 'patient_info';
      firstName: string;
      middleName: string;
      date: string;
      time: string;
    };

/** Тело ответа на шаг. Заполняются только поля этого действия. */
export const buildAnswer = (
  step: Pick<QuestionnaireStep, 'step_key'>,
  action: QuestionnaireAction,
): QuestionnaireStepAnswer => {
  const step_key = step.step_key;

  switch (action.type) {
    case 'text':
      return { step_key, value: action.text.trim() };
    case 'choice':
      return { step_key, choice: action.value };
    case 'choice_text': {
      const comment = action.text.trim();
      return comment
        ? { step_key, choice: action.value, value: comment }
        : { step_key, choice: action.value };
    }
    case 'none':
      return { step_key, none: true };
    case 'specialization':
      return { step_key, specialization_id: action.id };
    case 'doctor':
      return { step_key, doctor_membership_id: action.membershipId };
    case 'patient_info': {
      const middleName = action.middleName.trim();
      return {
        step_key,
        first_name: action.firstName.trim(),
        ...(middleName ? { middle_name: middleName } : {}),
        appointment_date: action.date,
        appointment_time: action.time,
      };
    }
  }
};

const chipLabel = (
  prompt: ChatPrompt,
  matches: (chip: ChatChip) => boolean,
): string | null => prompt.chips.find(matches)?.label ?? null;

/** Текст пузыря пациента: то, что он ответил, человеческими словами. */
export const patientReplyText = (
  prompt: ChatPrompt,
  action: ChatAction,
): string => {
  switch (action.type) {
    case 'text':
      return action.text.trim();
    case 'choice':
      return (
        chipLabel(
          prompt,
          (chip) => chip.kind === 'choice' && chip.value === action.value,
        ) ?? action.value
      );
    case 'choice_text': {
      const label =
        chipLabel(
          prompt,
          (chip) => chip.kind === 'select' && chip.value === action.value,
        ) ?? action.value;
      const comment = action.text.trim();
      return comment ? `${label}. ${comment}` : label;
    }
    case 'none':
      return NONE_LABEL;
    case 'specialization':
      return (
        chipLabel(
          prompt,
          (chip) => chip.kind === 'specialization' && chip.id === action.id,
        ) ?? ''
      );
  }
};

// ---------------------------------------------------------------------------
// Дата и время приёма

/** Дата в формате YYYY-MM-DD по локальному времени, без сдвига часового пояса. */
export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Дата в диапазоне шага, границы включительно. Границы — по часам сервера:
 * он проверяет дату по своим, и «сегодня» телефона около полуночи дало бы
 * отказ. Нет границы — нет ограничения с этой стороны.
 */
export const isDateInRange = (
  value: string,
  min: string | null,
  max: string | null,
): boolean => {
  if (!value) return false;
  if (min && value < min) return false;
  if (max && value > max) return false;

  return true;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Значения колеса часов. */
export const TIME_HOURS: readonly string[] = Array.from(
  { length: 24 },
  (_, index) => pad2(index),
);

/**
 * Значения колеса минут. Без шага: backend принимает любое время, а приём
 * бывает назначен и на 09:12.
 */
export const TIME_MINUTES: readonly string[] = Array.from(
  { length: 60 },
  (_, index) => pad2(index),
);

// То же правило, что у backend (`_APPOINTMENT_TIME_RE` в
// `questionnaire_flow.py`): любое время суток, строго две цифры и две цифры.
const APPOINTMENT_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Примет ли backend такое время приёма: `HH:MM`, 00:00–23:59. */
export const isAppointmentTime = (value: string): boolean =>
  APPOINTMENT_TIME.test(value);

/**
 * Часы и минуты для колёс выбора времени. Пока время не выбрано (или
 * значение некорректно) — полдень, середина рабочего дня.
 */
export const splitAppointmentTime = (
  value: string,
): { hour: string; minute: string } => {
  const match = APPOINTMENT_TIME.exec(value);

  return match
    ? { hour: match[1], minute: match[2] }
    : { hour: '12', minute: '00' };
};

// ---------------------------------------------------------------------------
// Ввод пациента

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
 * Предел длины имени и отчества в схеме backend: длиннее — 422, и пациент
 * застрял бы на экране даты без пути назад к имени.
 */
export const PATIENT_NAME_MAX_LENGTH = 255;

/** Имя заполнено. Отчество необязательно — так же проверяет backend. */
export const isValidPatientName = (value: string): boolean =>
  value.trim().length > 0;

/**
 * Ожидаемое число вопросов. Только для оценки прогресса: настоящее число
 * зависит от того, сколько уточняющих задаст ИИ, и заранее не известно.
 */
const EXPECTED_QUESTIONS = 8;

/**
 * Оценка прогресса по числу ответов: backend прогресс не отдаёт (ВЗ-3).
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
