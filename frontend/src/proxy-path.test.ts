import { describe, expect, it } from 'vitest';
import { isBlockedInternalMlPath } from './proxy-path';

describe('internal ML path boundary', () => {
  it.each([
    '/api/ml/questionnaire_answer_guard',
    '/api/ml/questionnaire_answer_guard/',
    '/api/ml/questionnaire_answer_guard/extra',
    '/api/ml/%71uestionnaire_answer_guard',
    '/api/ml/questionnaire%5fanswer%5fguard',
    '/api/ml/%2571uestionnaire_answer_guard',
    '/api/ml/a/%2e%2e/questionnaire_answer_guard',
  ])('не пропускает внутренний маршрут %s', (path) => {
    expect(isBlockedInternalMlPath(path)).toBe(true);
  });

  it.each([
    '/api/ml/collect_form',
    '/api/ml/autocomplete/complete',
    '/api/ml/check_dms',
  ])('%s остаётся доступен', (path) => {
    expect(isBlockedInternalMlPath(path)).toBe(false);
  });
});
