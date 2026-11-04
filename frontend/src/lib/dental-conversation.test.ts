import { expect, it } from 'vitest';
import type { QuestionnaireStep } from '@/api';
import {
  conversationAnswer,
  conversationGroup,
  toggleReply,
} from './dental-conversation';

const step = {
  step_key: 'dental_pain',
  step_type: 'chip_groups',
  groups: [{ key: 'wrong', question: 'Не показывать', options: [] }],
  dental: {
    question_key: 'pain.where',
    question: {
      key: 'pain.where',
      question: 'Где болит?',
      multiple: true,
      options: [
        { value: 'left', label: 'Слева' },
        { value: 'right', label: 'Справа' },
      ],
      text: { show: 'always', placeholder: 'Ответ' },
    },
  },
} as unknown as QuestionnaireStep;
it('renders only the authoritative active question and accepts free text instead of a choice', () => {
  expect(conversationGroup(step)?.key).toBe('pain.where');
  expect(conversationAnswer(step, 'Под коронкой')).toEqual({
    step_key: 'dental_pain',
    choice: 'question:pain.where',
    selections: {},
    texts: { 'pain.where': 'Под коронкой' },
  });
  expect(conversationAnswer(step, 'Слева; сильнее при еде')).toEqual({
    step_key: 'dental_pain',
    choice: 'question:pain.where',
    selections: { 'pain.where': ['left'] },
    texts: { 'pain.where': 'сильнее при еде' },
  });
  expect(conversationAnswer(step, 'Слева больше не болит').selections).toEqual(
    {},
  );
});
it('fills and edits the same reply without dropping free text or splitting commas', () => {
  expect(
    conversationAnswer(
      step,
      'Первая строка\nВторая строка; со своими знаками',
      [],
    ).texts?.['pain.where'],
  ).toBe('Первая строка\nВторая строка; со своими знаками');
  expect(
    conversationAnswer(step, 'Слева; не подтверждено', []).selections,
  ).toEqual({});
  expect(toggleReply('Свой текст, с запятой', 'Слева', true)).toBe(
    'Свой текст, с запятой; Слева',
  );
  expect(toggleReply('Свой текст, с запятой; Слева', 'Слева', true)).toBe(
    'Свой текст, с запятой',
  );
  expect(toggleReply('старый ответ', 'Новый', false)).toBe('Новый');
});
it('keeps health as one list question with explicit none, uncertainty and free comment', () => {
  const health = {
    step_key: 'dental_health_1',
    step_type: 'checklist',
    choices: [{ value: 'dry', label: 'Сухость во рту' }],
    dental: { question_key: 'health' },
  } as QuestionnaireStep;
  expect(conversationAnswer(health, 'Ничего из этого нет')).toEqual({
    step_key: 'dental_health_1',
    choice: 'question:health',
    none: true,
  });
  expect(
    conversationAnswer(health, 'Сухость во рту; Иногда после еды'),
  ).toEqual({
    step_key: 'dental_health_1',
    choice: 'question:health',
    selections: { health: ['dry'] },
    texts: { health: 'Иногда после еды' },
  });
  expect(
    conversationAnswer(health, 'Не знаю: Сухость во рту').selections,
  ).toEqual({ health: [], health_unknown: ['dry'] });
});
