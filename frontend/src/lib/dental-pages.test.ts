import { describe, expect, it } from 'vitest';
import type { QuestionnaireStep } from '@/api';
import {
  buildChecklistAnswer,
  buildGroupsAnswer,
  dentalNavigation,
  dentalProgress,
  draftForDentalStep,
  parseGroups,
  scopedChecklistValues,
} from './dental-questionnaire';
import {
  dentalDraftBaseline,
  readDentalDraft,
  saveDentalDraft,
} from './dental-draft-storage';

const healthPage = (health: string[] | null, unknown: string[] = []) => ({
  step_key: 'dental_health_2', step_type: 'checklist',
  choices: [{ value: 'allergy', label: 'Аллергия' }],
  dental: {
    revision: 4,
    answers: { health, health_unknown: unknown, groups: {}, flow_version: 2, health_answered: [] },
    progress: { current: 4, total: 10, label: 'Инфекции и перенесённые события' },
    page: { kind: 'health', current: 2, total: 6 },
  },
}) as unknown as QuestionnaireStep;

describe('short dental pages', () => {
  it('uses authoritative progress while retaining full-descriptor and string legacy fallbacks', () => {
    expect(dentalProgress(healthPage([]))).toEqual({
      current: 4, total: 10, label: 'Инфекции и перенесённые события',
    });
    expect(dentalProgress({ step_key: 'dental_health' } as QuestionnaireStep))
      .toEqual(dentalProgress('dental_health'));
    expect(dentalProgress('unknown')).toBeNull();
  });

  it('submits only current-page positives and unknowns from the global draft', () => {
    const page = healthPage(['diabetes'], ['allergy', 'asthma']);
    const draft = draftForDentalStep(page);
    const { checked, uncertain } = scopedChecklistValues(page, draft);
    expect(buildChecklistAnswer(page.step_key, checked, uncertain)).toEqual({
      step_key: 'dental_health_2',
      selections: { health: [], health_unknown: ['allergy'] },
    });
    expect(draft.selections.health).toEqual(['diabetes']);
    expect(draft.selections.health_unknown).toEqual(['allergy', 'asthma']);
    const negative = scopedChecklistValues(healthPage(['diabetes']), draftForDentalStep(healthPage(['diabetes'])));
    expect(buildChecklistAnswer(page.step_key, negative.checked, negative.uncertain))
      .toEqual({ step_key: page.step_key, none: true });
  });

  it('retains an unsent page draft across other-page changes but rejects changes to its own answers', () => {
    const values = new Map<string, string>();
    const store = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const page = healthPage(null);
    const draft = { selections: { health: ['allergy'] }, texts: {} };
    saveDentalDraft(store, 'q', page.step_key, 4, draft, 100, dentalDraftBaseline(page));
    expect(readDentalDraft(store, 'q', page.step_key, 5, 101,
      dentalDraftBaseline(healthPage(['diabetes'], ['asthma'])))).toEqual(draft);
    expect(readDentalDraft(store, 'q', page.step_key, 5, 101,
      dentalDraftBaseline(healthPage([], ['allergy'])))).toBeNull();
    expect(readDentalDraft(store, 'q', 'dental_health_3', 4, 101)).toBeNull();
  });

  it('uses server navigation labels only for allowed previous steps', () => {
    const page = healthPage([]);
    page.dental!.editable_steps = ['dental_reason', 'dental_health_1'];
    page.dental!.navigation = [
      { step_key: 'dental_reason', label: 'Повод визита' },
      { step_key: 'dental_health_1', label: 'Общее самочувствие' },
      { step_key: 'dental_health_3', label: 'Будущая страница' },
    ];
    expect(dentalNavigation(page)).toEqual(page.dental!.navigation.slice(0, 2));
    expect(dentalNavigation({ dental: { editable_steps: ['dental_health'] } } as QuestionnaireStep))
      .toEqual([{ step_key: 'dental_health', label: 'здоровье' }]);
  });

  it('distinguishes an unanswered page from explicit No without using coverage from other pages', () => {
    const unanswered = healthPage([]);
    unanswered.dental!.answers = {
      ...unanswered.dental!.answers, health_answered: ['diabetes'], flow_version: 2,
    };
    const elsewhere = healthPage([]);
    elsewhere.dental!.answers = {
      ...elsewhere.dental!.answers, health_answered: ['diabetes', 'asthma'], flow_version: 2,
    };
    const answeredNo = healthPage([]);
    answeredNo.dental!.answers = {
      ...answeredNo.dental!.answers, health_answered: ['allergy', 'diabetes'], flow_version: 2,
    };
    expect(dentalDraftBaseline(elsewhere)).toBe(dentalDraftBaseline(unanswered));
    expect(dentalDraftBaseline(answeredNo)).not.toBe(dentalDraftBaseline(unanswered));
  });

  it('also distinguishes an unanswered legacy checklist from its saved negative answer', () => {
    const legacy = { ...healthPage(null), dental: { revision: 0,
      answers: { health: null, health_unknown: [], groups: {} } } } as QuestionnaireStep;
    const answered = { ...legacy, dental: { revision: 1,
      answers: { health: [], health_unknown: [], groups: {} } } } as QuestionnaireStep;
    expect(dentalDraftBaseline(answered)).not.toBe(dentalDraftBaseline(legacy));
  });

  it('keeps other detail-page group values in the draft but submits the descriptor groups alone', () => {
    const page = {
      step_key: 'dental_details_medications',
      groups: [{ key: 'medications.dose', question: 'Доза?', options: [],
        text: { show: 'always' } }],
      dental: { answers: { health: ['allergy'], groups: {
        'medications.dose': { selected: [], text: '5 мг' },
        'allergy.detail': { selected: ['drug'], text: 'пенициллин' },
      } } },
    } as unknown as QuestionnaireStep;
    const draft = draftForDentalStep(page);
    expect(buildGroupsAnswer(page.step_key, parseGroups(page), draft)).toEqual({
      step_key: page.step_key, selections: {}, texts: { 'medications.dose': '5 мг' },
    });
    expect(draft.texts['allergy.detail']).toBe('пенициллин');
  });
});
