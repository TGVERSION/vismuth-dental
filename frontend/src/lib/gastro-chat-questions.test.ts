import { describe, expect, it } from 'vitest';
import {
  GASTRO_CHAT_FOLLOWUPS,
  gastroFollowupChoices,
} from './gastro-chat-questions';
import { chatPrompt, patientReplyText, buildAnswer } from './questionnaire';
import type { QuestionnaireStep } from '@/api';

describe('быстрые ответы отдельных вопросов о стуле', () => {
  for (const key of [
    'stool_frequency',
    'stool_form',
    'stool_recent_changes',
    'stool_change_onset',
  ] as const) {
    it(`${key}: кнопки видны в чате и отправляют именно выбранное значение`, () => {
      const question = GASTRO_CHAT_FOLLOWUPS[key];
      const step = {
        step_key: key,
        step_type: 'text',
        text: question.text,
        choices: gastroFollowupChoices(question),
      } as QuestionnaireStep;
      const prompt = chatPrompt(step);
      expect(prompt.input).toBe('text');
      expect(prompt.text).toContain('\n\n');
      for (const option of step.choices ?? []) {
        expect(prompt.chips).toContainEqual({ kind: 'choice', ...option });
        const action = { type: 'choice' as const, value: option.value };
        expect(patientReplyText(prompt, action)).toBe(option.label);
        expect(buildAnswer(step, action)).toEqual({
          step_key: key,
          choice: option.value,
        });
      }
    });
  }
});
