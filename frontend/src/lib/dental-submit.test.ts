import { expect, it } from 'vitest';
import { dentalReloadDecision, withDentalRevision } from './dental-submit';
import type { QuestionnaireStep } from '@/api';
const step = (key: string, revision: number) =>
  ({
    step_key: key,
    dental: { revision },
    completed: false,
  }) as QuestionnaireStep;
it('attaches the latest server revision to answer and edit requests', () => {
  expect(
    withDentalRevision(step('dental_health', 7), {
      step_key: 'dental_health',
      none: true,
    }),
  ).toEqual({ step_key: 'dental_health', revision: 7, none: true });
});
it('reconciles a lost response while preserving same-step input after conflict', () => {
  expect(dentalReloadDecision('dental_health', step('dental_about', 8))).toBe(
    'advanced',
  );
  expect(dentalReloadDecision('dental_health', step('dental_health', 8))).toBe(
    'retry',
  );
});
