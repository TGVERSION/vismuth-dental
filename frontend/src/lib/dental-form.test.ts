import { expect, it } from 'vitest';
import type { QuestionnaireStep } from '@/api';
import {
  buildGroupsAnswer,
  canSubmitGroups,
  dentalFormStage,
  dentalFormStep,
  parseGroups,
  draftForDentalStep,
} from './dental-questionnaire';

it('shows all section fields and permits a typed answer instead of an unknown button', () => {
  const step = dentalFormStep({
    step_key: 'dental_details_allergy',
    groups: [
      {
        key: 'allergy.substance',
        question: 'На что?',
        required: true,
        options: [{ value: 'antibiotics', label: 'Антибиотики' }],
        text: null,
      },
      {
        key: 'allergy.reaction',
        question: 'Как проявлялась?',
        options: [],
        text: null,
      },
    ],
  } as unknown as QuestionnaireStep);
  const groups = parseGroups(step);
  expect(groups).toHaveLength(2);
  const draft = {
    selections: {},
    texts: {
      'allergy.substance': 'Не помню название',
      'allergy.reaction': 'Сыпь',
    },
  };
  expect(canSubmitGroups(groups, draft)).toBe(true);
  expect(canSubmitGroups(groups, { selections: {}, texts: {} })).toBe(false);
  expect(buildGroupsAnswer(step.step_key, groups, draft).texts).toEqual(
    draft.texts,
  );
});

it('keeps four stages stable and health subprogress independent of conditional details', () => {
  const step = {
    step_key: 'dental_health_2',
    dental: { page: { kind: 'health', current: 2, total: 6 } },
  } as QuestionnaireStep;
  expect(dentalFormStage(step)).toMatchObject({
    current: 2,
    label: 'Здоровье · раздел 2 из 6',
  });
  expect(
    dentalFormStage({ step_key: 'dental_about' } as QuestionnaireStep).current,
  ).toBe(4);
});

it('restores the old free health comment in its own section', () => {
  const step = {
    step_key: 'dental_health_1',
    step_type: 'checklist',
    dental: {
      answers: {
        groups: {},
        health: [],
        health_unknown: [],
        health_comments: {
          dental_health_1: 'Свой ответ',
          dental_health_2: 'Другой ответ',
        },
      },
    },
  } as unknown as QuestionnaireStep;
  expect(draftForDentalStep(step).texts.health).toBe('Свой ответ');
});
