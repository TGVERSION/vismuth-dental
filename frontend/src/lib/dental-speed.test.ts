import { expect, it } from 'vitest';
import {
  buildChecklistAnswer,
  draftForDentalStep,
  parseGroups,
} from './dental-questionnaire';
import type { QuestionnaireStep } from '@/api';
it('keeps an old unknown dose in the editable field when it becomes a suggestion', () => {
  const step = { dental: { answers: { groups: {
    'medications.dose': { selected: ['unknown'], text: 'уточню дома' },
  } } } } as unknown as QuestionnaireStep;
  const draft = draftForDentalStep(step);
  expect(draft.texts['medications.dose']).toBe('Дозу не помню; уточню дома');
  expect(draft.selections['medications.dose']).toEqual([]);
});
it('keeps unknown health answers separate and does not mark them negative', () => {
  expect(buildChecklistAnswer('dental_health', [], ['allergy'])).toEqual({
    step_key: 'dental_health',
    selections: { health: [], health_unknown: ['allergy'] },
  });
});
it('hydrates backend groups and health when returning to an answered step', () => {
  const step = {
    dental: {
      revision: 4,
      answers: {
        health: ['diabetes'],
        health_unknown: ['allergy'],
        groups: { reason: { selected: ['pain'], text: 'сегодня' } },
      },
    },
  } as unknown as QuestionnaireStep;
  expect(draftForDentalStep(step)).toEqual({
    selections: {
      reason: ['pain'],
      health: ['diabetes'],
      health_unknown: ['allergy'],
    },
    texts: { reason: 'сегодня' },
  });
});
it('preserves exact/free input metadata and quick choices supplied by server', () => {
  const step = {
    groups: [
      {
        key: 'year',
        question: 'Когда?',
        options: [],
        text: {
          show: 'always',
          input_kind: 'year',
          input_mode: 'numeric',
          quick_choices: ['Не помню'],
          optional_reveal: true,
          max_length: 20000,
        },
      },
    ],
  } as unknown as QuestionnaireStep;
  expect(parseGroups(step)[0].text).toMatchObject({
    input_kind: 'year',
    input_mode: 'numeric',
    quick_choices: ['Не помню'],
    optional_reveal: true,
    max_length: 20000,
  });
});
