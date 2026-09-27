// Сценарий диалога заглушки: вопросы из ТЗ для первичного и повторного
// приёма плюс имитация уточняющих вопросов ИИ.
//
// Что здесь настоящее, а что нет:
// - настоящие: структура сообщения, коды шагов, лимиты уточняющих (6 и 2),
//   признак `finished` — по ним фронтенд ведёт себя ровно так же, как будет
//   вести с настоящим сервером;
// - ненастоящие: сами уточняющие вопросы. Они собраны по шаблону из ответа
//   пациента и помечены как демонстрационные, чтобы их нельзя было принять
//   за работу ИИ.

import type { QuestionnaireMessage, QuestionnaireMessageInput } from '@/api';

export type VisitType = 'primary' | 'repeat';

export interface ScriptStep {
  step: string;
  text: string;
  quick_replies: string[] | null;
  input: QuestionnaireMessageInput;
  /** Сколько уточняющих вопросов ИИ задаётся после этого шага. */
  clarifications?: number;
}

/** Первый вопрос одинаков для обеих веток: от него зависит остальной сценарий. */
export const VISIT_TYPE_STEP: ScriptStep = {
  step: 'visit_type',
  text: 'Вы на первичный или повторный приём?',
  quick_replies: ['Первичный', 'Повторный'],
  input: 'choice',
};

/** Лимиты уточняющих из ТЗ: жёсткие, а не «пожелание в промпте». */
export const CLARIFICATION_LIMIT: Record<VisitType, number> = {
  primary: 6,
  repeat: 2,
};

const PRIMARY_STEPS: ScriptStep[] = [
  {
    step: 'complaints',
    text: 'Что вас беспокоит?',
    quick_replies: null,
    input: 'text',
    clarifications: 3,
  },
  {
    step: 'medications',
    text: 'Принимаете ли сейчас какие-то лекарства? Какие?',
    quick_replies: ['Нет, не принимаю'],
    input: 'text',
  },
  {
    step: 'chronic',
    text: 'Есть ли хронические заболевания?',
    quick_replies: ['Нет'],
    input: 'text',
  },
  {
    step: 'allergies',
    text: 'Есть ли аллергия на лекарства?',
    quick_replies: ['Нет'],
    input: 'text',
  },
];

const REPEAT_STEPS: ScriptStep[] = [
  {
    step: 'changes',
    text: 'Что изменилось после прошлого приёма?',
    quick_replies: ['Стало лучше', 'Стало хуже', 'Без изменений'],
    input: 'text',
  },
  {
    step: 'adherence',
    text: 'Выполняли ли назначения врача?',
    quick_replies: ['Да', 'Частично', 'Нет'],
    input: 'choice',
  },
  {
    step: 'side_effects',
    text: 'Были ли побочные эффекты или новые жалобы?',
    quick_replies: ['Нет'],
    input: 'text',
    clarifications: 2,
  },
];

export const stepsForVisitType = (visitType: VisitType): ScriptStep[] =>
  visitType === 'primary' ? PRIMARY_STEPS : REPEAT_STEPS;

export const visitTypeFromAnswer = (answer: string): VisitType =>
  answer.trim().toLowerCase().startsWith('повтор') ? 'repeat' : 'primary';

/** Демонстрационный уточняющий вопрос. Настоящий пришёл бы от GigaChat. */
const CLARIFICATION_TEMPLATES = [
  'Как давно это началось?',
  'Что-то усиливает или облегчает это состояние?',
  'Насколько сильно это мешает в обычный день?',
  'Были ли подобные жалобы раньше?',
  'Есть ли температура или другие симптомы?',
  'Обращались ли вы с этим к врачу раньше?',
];

export const clarificationText = (index: number): string =>
  `${CLARIFICATION_TEMPLATES[index % CLARIFICATION_TEMPLATES.length]} (демонстрационный вопрос заглушки)`;

export const makeMessage = (
  partial: Omit<QuestionnaireMessage, 'id' | 'ai_unavailable' | 'progress'> & {
    ai_unavailable?: boolean;
    progress?: number | null;
  },
): QuestionnaireMessage => ({
  id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ai_unavailable: false,
  progress: null,
  ...partial,
});

/**
 * Сколько вопросов всего в сценарии: первый про тип приёма, затем шаги ветки
 * и уточняющие после тех шагов, где они предусмотрены. При недоступном ИИ
 * уточняющих не будет, и общее число меньше.
 */
export const totalQuestions = (
  visitType: VisitType,
  aiAvailable: boolean,
): number => {
  const steps = stepsForVisitType(visitType);
  const clarifications = aiAvailable
    ? steps.reduce(
        (sum, step) =>
          sum +
          Math.min(step.clarifications ?? 0, CLARIFICATION_LIMIT[visitType]),
        0,
      )
    : 0;

  return 1 + steps.length + clarifications;
};

/** Доля пройденного от 0 до 1. */
export const progressFor = (answered: number, total: number): number =>
  total <= 0 ? 0 : Math.min(1, Math.round((answered / total) * 100) / 100);

export const FINAL_MESSAGE_TEXT =
  'Спасибо! Это всё, что нужно. Остался последний шаг — как вас зовут и когда вы записаны.';
