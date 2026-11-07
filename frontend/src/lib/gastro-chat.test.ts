import { describe, expect, it } from 'vitest';
import { gastroChatReply, gastroChatNextField } from './gastro-chat';
import type { GastroField } from './gastro-questionnaire';

const fields: GastroField[] = [
  {
    key: 'status',
    label: 'Принимаете лекарства?',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'detail',
    label: 'Какие?',
    type: 'multiline',
    show_when: { key: 'status', value: 'yes' },
  },
  { key: 'last', label: 'Что ещё?', type: 'text' },
];
describe('gastro conversational navigation', () => {
  it('asks a dependent question immediately, and skips it for a negative answer', () => {
    expect(
      gastroChatNextField(fields, { status: ['yes'] }, 'status')?.key,
    ).toBe('detail');
    expect(gastroChatNextField(fields, { status: ['no'] }, 'status')?.key).toBe(
      'last',
    );
    expect(gastroChatNextField(fields, { status: ['yes'] }, 'last')).toBeNull();
  });
  it('shows human choice labels and preserves all of a long patient answer', () => {
    expect(gastroChatReply(fields[0], ['no'])).toBe('Нет');
    const text = 'История '.repeat(1500);
    expect(gastroChatReply(fields[1], text)).toBe(text);
    expect(gastroChatReply(fields[2], undefined)).toBe('Пропущено');
  });
});
