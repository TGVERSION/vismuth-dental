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

export type DentalScreen =
  | 'chips'
  | 'checklist'
  | 'review'
  | 'done'
  | 'unknown';

export const dentalScreenFor = (step: QuestionnaireStep): DentalScreen => {
  if (step.completed || step.step_type === 'done') return 'done';
  if (step.step_type === 'chip_groups') return 'chips';
  if (step.step_type === 'checklist') return 'checklist';
  if (step.step_type === 'dental_review') return 'review';
  return 'unknown';
};

export interface DentalProgress {
  current: number;
  total: number;
  label: string;
}

const PROGRESS: Record<string, DentalProgress> = {
  dental_reason: { current: 1, total: 3, label: 'Зачем пришли' },
  dental_pain: { current: 1, total: 3, label: 'Зачем пришли' },
  dental_health: { current: 2, total: 3, label: 'Здоровье' },
  dental_details: { current: 2, total: 3, label: 'Уточнение' },
  dental_about: { current: 3, total: 3, label: 'О вас' },
  dental_ai: { current: 3, total: 3, label: 'Уточнение' },
  dental_review: { current: 3, total: 3, label: 'Проверка ответов' },
};

/** Шаг уточняющего вопроса нейросети. */
export const AI_STEP = 'dental_ai';

/** Новый маршрут задаёт точный прогресс; прежние дескрипторы совместимы. */
export const dentalProgress = (
  step: QuestionnaireStep | string,
): DentalProgress | null =>
  typeof step === 'string'
    ? (PROGRESS[step] ?? null)
    : (step.dental?.progress ?? PROGRESS[step.step_key] ?? null);

const STEP_LABELS: Record<string, string> = {
  dental_reason: 'повод визита',
  dental_pain: 'боль',
  dental_health: 'здоровье',
  dental_details: 'уточнения',
  dental_about: 'о вас',
};

/** Только разрешённые сервером переходы, в порядке пройденных страниц. */
export const dentalNavigation = (step: QuestionnaireStep) =>
  (step.dental?.editable_steps ?? []).map((step_key) => ({
    step_key,
    label:
      step.dental?.navigation?.find((item) => item.step_key === step_key)
        ?.label ??
      STEP_LABELS[step_key] ??
      'ответы',
  }));

// ---------------------------------------------------------------------------
// Группы кнопок

export type TextShow = 'always' | 'on_select' | 'on_other';

export interface DentalOption {
  value: string;
  label: string;
}

export interface DentalGroup {
  key: string;
  /** Тема уточнения, например «Аллергия». */
  title: string | null;
  question: string;
  options: DentalOption[];
  multiple: boolean;
  /** Нужно выбрать хотя бы один вариант. */
  required: boolean;
  free_text?: boolean;
  text: {
    placeholder: string;
    required: boolean;
    show: TextShow;
    input_kind?: 'date' | 'year' | 'pressure' | 'duration' | 'text';
    input_mode?: 'numeric' | 'decimal' | 'text';
    quick_choices?: string[];
    optional_reveal?: boolean;
    max_length?: number;
  } | null;
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
    input_kind: ['date', 'year', 'pressure', 'duration'].includes(
      String(raw.input_kind),
    )
      ? (raw.input_kind as 'date' | 'year' | 'pressure' | 'duration')
      : 'text',
    input_mode:
      raw.input_mode === 'numeric' || raw.input_mode === 'decimal'
        ? raw.input_mode
        : 'text',
    quick_choices: Array.isArray(raw.quick_choices)
      ? raw.quick_choices.filter((x): x is string => typeof x === 'string')
      : [],
    optional_reveal: raw.optional_reveal === true,
    max_length:
      typeof raw.max_length === 'number'
        ? Math.min(20000, raw.max_length)
        : ANSWER_MAX_LENGTH,
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
    ...(raw.free_text === true ? { free_text: true } : {}),
    text: parseText(raw.text),
  };
};

/** Группы шага `chip_groups`. Битые записи пропускаются, а не роняют экран. */
export const parseGroups = (step: QuestionnaireStep): DentalGroup[] =>
  (step.groups ?? [])
    .map(parseGroup)
    .filter((group): group is DentalGroup => group !== null);

export const isDentalDetailsStep = (key: string): boolean =>
  key === 'dental_details' || key.startsWith('dental_details_');

/** Форма использует все поля серверного раздела, включая старые текстовые ответы. */
export const dentalFormStep = (step: QuestionnaireStep): QuestionnaireStep => ({
  ...step,
  groups: parseGroups(step)
    .filter((group) => group.key !== 'about.more')
    .map((group) => ({
      ...group,
      question:
        group.key === 'allergy.substance'
          ? 'На что была аллергическая реакция?'
          : group.key === 'allergy.reaction'
            ? 'Как проявлялась аллергия?'
            : group.question,
      required:
        group.required ||
        group.key === 'medications' ||
        isDentalDetailsStep(step.step_key),
      free_text: group.options.length === 0,
      text: group.text
        ? {
            ...group.text,
            required: group.text.required || isDentalDetailsStep(step.step_key),
            optional_reveal: false,
            show:
              group.options.length &&
              (!group.text.input_kind || group.text.input_kind === 'text')
                ? 'on_other'
                : 'always',
          }
        : null,
    })),
});

export const dentalFormStage = (step: QuestionnaireStep) => {
  const key = step.step_key;
  if (key === 'dental_reason')
    return { current: 1, title: 'Повод обращения', label: 'Этап 1 из 4' };
  if (key.startsWith('dental_health'))
    return {
      current: 2,
      title: 'Здоровье',
      label:
        step.dental?.page?.kind === 'health'
          ? `Здоровье · раздел ${step.dental.page.current} из ${step.dental.page.total}`
          : 'Этап 2 из 4',
    };
  if (isDentalDetailsStep(key) || key === AI_STEP)
    return {
      current: 3,
      title: 'Уточнения',
      label:
        step.dental?.page?.kind === 'details'
          ? `Уточнения · раздел ${step.dental.page.current} из ${step.dental.page.total}`
          : 'Этап 3 из 4',
    };
  return { current: 4, title: 'Дополнительно', label: 'Этап 4 из 4' };
};

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

/** Сохранённые ответы приходят с сервера и не задают маршрут на клиенте. */
export const draftForDentalStep = (step: QuestionnaireStep): DentalDraft => {
  const answers = step.dental?.answers;
  if (!answers) return EMPTY_DRAFT;
  const selections: Record<string, string[]> = {};
  const texts: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers.groups ?? {})) {
    selections[key] = [...value.selected];
    texts[key] = value.text;
  }
  if (step.step_type === 'checklist')
    texts.health = answers.health_comments?.[step.step_key] ?? '';
  selections.health = [...(answers.health ?? [])];
  selections.health_unknown = [...(answers.health_unknown ?? [])];
  return normalizeDentalDraft({ selections, texts });
};

/** Совместимость сохранённого ответа и локального черновика прежней версии. */
export const normalizeDentalDraft = (draft: DentalDraft): DentalDraft => {
  const key = 'medications.dose';
  const selected = draft.selections[key] ?? [];
  if (!selected.includes('unknown')) return draft;
  const text = draft.texts[key] ?? '';
  return {
    selections: {
      ...draft.selections,
      [key]: selected.filter((x) => x !== 'unknown'),
    },
    texts: {
      ...draft.texts,
      [key]: text.includes('Дозу не помню')
        ? text
        : ['Дозу не помню', text].filter(Boolean).join('; '),
    },
  };
};

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
  maxLength = ANSWER_MAX_LENGTH,
): DentalDraft => ({
  ...draft,
  texts: { ...draft.texts, [key]: text.slice(0, maxLength) },
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
  if (
    group.required &&
    selected.length === 0 &&
    !(group.free_text && (draft.texts[group.key] ?? '').trim())
  )
    return 'choose';
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
  section?: string;
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
      ...(typeof raw.section === 'string' ? { section: raw.section } : {}),
    }));

/** Глобальный черновик хранится целиком, но ответ принадлежит одной странице. */
export const scopedChecklistValues = (
  step: QuestionnaireStep,
  draft: DentalDraft,
): { checked: string[]; uncertain: string[] } => {
  const visible = new Set(parseChecklist(step).map((item) => item.value));
  return {
    checked: (draft.selections.health ?? []).filter((value) =>
      visible.has(value),
    ),
    uncertain: (draft.selections.health_unknown ?? []).filter((value) =>
      visible.has(value),
    ),
  };
};

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
  uncertain: readonly string[] = [],
): QuestionnaireStepAnswer =>
  checked.length === 0 && uncertain.length === 0
    ? { step_key: stepKey, none: true }
    : {
        step_key: stepKey,
        selections: {
          [HEALTH_KEY]: [...checked],
          ...(uncertain.length ? { health_unknown: [...uncertain] } : {}),
        },
      };

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
