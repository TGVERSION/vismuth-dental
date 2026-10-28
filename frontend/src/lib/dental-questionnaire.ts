// Чистая логика стоматологической анкеты: всё, что можно проверить без
// браузера.
//
// Сценарий ведёт backend (`services/dental/flow.py`): он отдаёт шаг с группами
// кнопок или списком строк здоровья. Здесь — разбор шага, черновик ответа
// пациента (что нажато, что написано) и перевод черновика в тело запроса.
// Формы данных с сервера не принимаются на веру: всё сужается.

import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { ANSWER_MAX_LENGTH } from './questionnaire';

/** Значение «Другое» в группах: при нём нужен свой текст. */
export const OTHER = 'other';

const HEALTH_KEY = 'health';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

// ---------------------------------------------------------------------------
// Шаг и экран

export type DentalScreen = 'chips' | 'checklist' | 'done' | 'unknown';

export const dentalScreenFor = (step: QuestionnaireStep): DentalScreen => {
  if (step.completed || step.step_type === 'done') return 'done';
  if (step.step_type === 'chip_groups') return 'chips';
  if (step.step_type === 'checklist') return 'checklist';
  return 'unknown';
};

export interface DentalProgress {
  current: 1 | 2;
  total: 2;
  label: string;
}

const PROGRESS: Record<string, DentalProgress> = {
  dental_reason: { current: 1, total: 2, label: 'Зачем пришли' },
  dental_pain: { current: 1, total: 2, label: 'Зачем пришли' },
  dental_health: { current: 2, total: 2, label: 'Здоровье' },
  dental_details: { current: 2, total: 2, label: 'Уточнение' },
  dental_ai: { current: 2, total: 2, label: 'Уточнение' },
};

/** Шаг уточняющего вопроса нейросети. */
export const AI_STEP = 'dental_ai';

/** «Шаг 1 из 2 · Зачем пришли». Уточнения не меняют номер шага. */
export const dentalProgress = (stepKey: string): DentalProgress | null =>
  PROGRESS[stepKey] ?? null;

// ---------------------------------------------------------------------------
// Группы кнопок

export type TextShow = 'always' | 'on_select' | 'on_other';

export interface DentalOption {
  value: string;
  label: string;
}

export interface DentalGroup {
  key: string;
  /** Заголовок над группой: «Вы отметили: …». */
  title: string | null;
  question: string;
  options: DentalOption[];
  multiple: boolean;
  /** Нужно выбрать хотя бы один вариант. */
  required: boolean;
  text: { placeholder: string; required: boolean; show: TextShow } | null;
}

const TEXT_SHOW: readonly TextShow[] = ['always', 'on_select', 'on_other'];

const parseOption = (raw: unknown): DentalOption | null =>
  isRecord(raw) &&
  typeof raw.value === 'string' &&
  typeof raw.label === 'string'
    ? { value: raw.value, label: raw.label }
    : null;

const parseText = (raw: unknown): DentalGroup['text'] => {
  if (!isRecord(raw)) return null;
  const show = TEXT_SHOW.includes(raw.show as TextShow)
    ? (raw.show as TextShow)
    : 'on_select';
  return {
    placeholder: stringOr(raw.placeholder, ''),
    required: raw.required === true,
    show,
  };
};

const parseGroup = (raw: unknown): DentalGroup | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.key !== 'string' || typeof raw.question !== 'string')
    return null;
  if (!Array.isArray(raw.options)) return null;

  return {
    key: raw.key,
    title: typeof raw.title === 'string' ? raw.title : null,
    question: raw.question,
    options: raw.options
      .map(parseOption)
      .filter((option): option is DentalOption => option !== null),
    multiple: raw.multiple !== false,
    required: raw.required === true,
    text: parseText(raw.text),
  };
};

/** Группы шага `chip_groups`. Битые записи пропускаются, а не роняют экран. */
export const parseGroups = (step: QuestionnaireStep): DentalGroup[] =>
  (step.groups ?? [])
    .map(parseGroup)
    .filter((group): group is DentalGroup => group !== null);

// ---------------------------------------------------------------------------
// Черновик ответа

export interface DentalDraft {
  selections: Readonly<Record<string, readonly string[]>>;
  texts: Readonly<Record<string, string>>;
}

export const EMPTY_DRAFT: DentalDraft = Object.freeze({
  selections: Object.freeze({}),
  texts: Object.freeze({}),
});

const selectedIn = (draft: DentalDraft, key: string): readonly string[] =>
  draft.selections[key] ?? [];

/**
 * Нажатие на кнопку. В группе с одним ответом новое значение заменяет
 * прежнее, повторное нажатие снимает выбор.
 */
export const toggleOption = (
  draft: DentalDraft,
  group: DentalGroup,
  value: string,
): DentalDraft => {
  const current = selectedIn(draft, group.key);
  const isOn = current.includes(value);
  let next: string[];
  if (isOn) {
    next = current.filter((item) => item !== value);
  } else if (group.multiple) {
    next = [...current, value];
  } else {
    next = [value];
  }
  return { ...draft, selections: { ...draft.selections, [group.key]: next } };
};

export const setGroupText = (
  draft: DentalDraft,
  key: string,
  text: string,
): DentalDraft => ({
  ...draft,
  texts: { ...draft.texts, [key]: text.slice(0, ANSWER_MAX_LENGTH) },
});

/** Показывать ли поле для своего текста — правило приходит с сервера. */
export const isTextVisible = (
  group: DentalGroup,
  draft: DentalDraft,
): boolean => {
  if (!group.text) return false;
  const selected = selectedIn(draft, group.key);
  switch (group.text.show) {
    case 'always':
      return true;
    case 'on_other':
      return selected.includes(OTHER);
    case 'on_select':
      return selected.length > 0;
  }
};

/** Чего не хватает в группе: выбрать вариант или написать текст. */
export type GroupProblem = 'choose' | 'text';

export const groupProblem = (
  group: DentalGroup,
  draft: DentalDraft,
): GroupProblem | null => {
  const selected = selectedIn(draft, group.key);
  if (group.required && selected.length === 0) return 'choose';
  if (!group.text || !isTextVisible(group, draft)) return null;
  const needsText = group.text.required || selected.includes(OTHER);
  const hasText = (draft.texts[group.key] ?? '').trim().length > 0;
  return needsText && !hasText ? 'text' : null;
};

export const canSubmitGroups = (
  groups: readonly DentalGroup[],
  draft: DentalDraft,
): boolean => groups.every((group) => groupProblem(group, draft) === null);

/**
 * Тело ответа: только выбранные значения и тексты видимых полей. Текст
 * скрытого поля не уходит: пациент мог написать его при «Другое», а потом
 * снять выбор.
 */
export const buildGroupsAnswer = (
  stepKey: string,
  groups: readonly DentalGroup[],
  draft: DentalDraft,
): QuestionnaireStepAnswer => {
  const selections: Record<string, string[]> = {};
  const texts: Record<string, string> = {};
  for (const group of groups) {
    const selected = selectedIn(draft, group.key);
    if (selected.length > 0) selections[group.key] = [...selected];
    const text = (draft.texts[group.key] ?? '').trim();
    if (text && isTextVisible(group, draft)) texts[group.key] = text;
  }
  return {
    step_key: stepKey,
    selections,
    ...(Object.keys(texts).length > 0 ? { texts } : {}),
  };
};

/** «Пропустить» — только у вопроса нейросети (`allow_skip`). */
export const buildSkipAnswer = (stepKey: string): QuestionnaireStepAnswer => ({
  step_key: stepKey,
  skip: true,
});

// ---------------------------------------------------------------------------
// Список «Что из этого у вас есть?»

export interface DentalChecklistItem {
  value: string;
  label: string;
  hint: string;
}

export const parseChecklist = (
  step: QuestionnaireStep,
): DentalChecklistItem[] =>
  (step.choices as unknown[])
    .filter(isRecord)
    .filter(
      (raw) => typeof raw.value === 'string' && typeof raw.label === 'string',
    )
    .map((raw) => ({
      value: raw.value as string,
      label: raw.label as string,
      hint: stringOr(raw.hint, ''),
    }));

export const toggleChecklist = (
  checked: readonly string[],
  value: string,
): string[] =>
  checked.includes(value)
    ? checked.filter((item) => item !== value)
    : [...checked, value];

/** Ничего не отмечено — ответ «Ничего из этого нет». */
export const buildChecklistAnswer = (
  stepKey: string,
  checked: readonly string[],
): QuestionnaireStepAnswer =>
  checked.length === 0
    ? { step_key: stepKey, none: true }
    : { step_key: stepKey, selections: { [HEALTH_KEY]: [...checked] } };

// ---------------------------------------------------------------------------
// Приветствие

export const inviteGreeting = (
  firstName: string | null,
  middleName: string | null,
): string => {
  const name = [firstName, middleName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
  return name ? `${name}, здравствуйте!` : 'Здравствуйте!';
};

// ---------------------------------------------------------------------------
// Ошибки отправки

/**
 * - `expired` — срок ссылки истёк (410);
 * - `not_found` — токен больше не работает: выпущена новая ссылка или анкету
 *   удалили (401, 404);
 * - `stale` — сервер уже на другом шаге (409);
 * - `rejected` — сервер отклонил ответ (400): анкета уже заполнена или
 *   ответ не прошёл проверку;
 * - `subscription` — подписка клиники истекла (503);
 * - `other` — сеть, таймаут, 5xx.
 */
export type DentalErrorKind =
  | 'expired'
  | 'not_found'
  | 'stale'
  | 'rejected'
  | 'subscription'
  | 'other';

/**
 * Что случилось при отправке ответа. Проверка по форме, а не
 * `instanceof ApiError`: модуль импортируют и без клиента API.
 */
export const dentalErrorKind = (error: unknown): DentalErrorKind => {
  if (!(error instanceof Error) || error.name !== 'ApiError') return 'other';
  const { status, code } = error as Error & { status?: number; code?: string };
  if (status === 410) return 'expired';
  if (status === 401 || status === 404) return 'not_found';
  if (status === 409) return 'stale';
  if (status === 400) return 'rejected';
  if (status === 503 && code === 'subscription_expired') return 'subscription';
  return 'other';
};
