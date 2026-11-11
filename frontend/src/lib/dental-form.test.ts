import { expect, it } from 'vitest';
import type { QuestionnaireStep } from '@/api';
import {
  buildGroupsAnswer,
  canSubmitGroups,
  dentalFormStage,
  dentalFormStep,
  parseGroups,
  draftForDentalStep,
  isTextVisible,
} from './dental-questionnaire';

it('opens free text for choices only after Other and omits hidden text from the payload', () => {
  const step = dentalFormStep({
    step_key: 'dental_details_allergy',
    groups: [
      {
        key: 'allergy.substance',
        question: 'На что?',
        required: true,
        options: [
          { value: 'antibiotics', label: 'Антибиотики' },
          { value: 'other', label: 'Другое' },
        ],
        text: { placeholder: 'На что?', show: 'on_other' },
      },
      {
        key: 'allergy.reaction',
        question: 'Как проявлялась?',
        options: [],
        text: { placeholder: 'Проявления', show: 'always' },
      },
    ],
  } as unknown as QuestionnaireStep);
  const groups = parseGroups(step);
  expect(groups).toHaveLength(2);
  const draft = {
    selections: { 'allergy.substance': ['other'] },
    texts: {
      'allergy.substance': 'Не помню название',
      'allergy.reaction': 'Сыпь',
    },
  };
  expect(canSubmitGroups(groups, draft)).toBe(true);
  expect(isTextVisible(groups[0], draft)).toBe(true);
  const standard = {
    ...draft,
    selections: { 'allergy.substance': ['antibiotics'] },
  };
  expect(isTextVisible(groups[0], standard)).toBe(false);
  expect(
    buildGroupsAnswer(step.step_key, groups, standard).texts,
  ).not.toHaveProperty('allergy.substance');
  expect(canSubmitGroups(groups, { selections: {}, texts: {} })).toBe(false);
  expect(buildGroupsAnswer(step.step_key, groups, draft).texts).toEqual(
    draft.texts,
  );
});

it('does not render the removed extra-health field', () => {
  const step = dentalFormStep({
    step_key: 'dental_about',
    groups: [
      {
        key: 'about.more',
        question: 'Дополнительно о здоровье',
        options: [],
        text: { show: 'always' },
      },
      {
        key: 'about.visit_clinic',
        question: 'Клиника',
        options: [],
        text: { show: 'always' },
      },
    ],
  } as unknown as QuestionnaireStep);
  expect(parseGroups(step).map((group) => group.key)).toEqual([
    'about.visit_clinic',
  ]);
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
