import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
export const withDentalRevision = (
  step: QuestionnaireStep | null,
  answer: QuestionnaireStepAnswer,
): QuestionnaireStepAnswer =>
  step?.dental ? { ...answer, revision: step.dental.revision } : answer;
export const dentalReloadDecision = (
  answeredKey: string,
  fresh: QuestionnaireStep,
  questionKey?: string,
): 'advanced' | 'retry' =>
  fresh.completed ||
  fresh.step_key !== answeredKey ||
  (questionKey !== undefined && fresh.dental?.question_key !== questionKey)
    ? 'advanced'
    : 'retry';
