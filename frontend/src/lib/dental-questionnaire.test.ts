import { describe, expect, it } from 'vitest';
import type { QuestionnaireStep } from '@/api';
import { ApiError } from '@/api/base-client';
import {
  EMPTY_DRAFT,
  buildChecklistAnswer,
  buildGroupsAnswer,
  buildSkipAnswer,
  canSubmitGroups,
  dentalErrorKind,
  dentalProgress,
  dentalScreenFor,
  groupProblem,
  inviteGreeting,
  isTextVisible,
  parseChecklist,
  parseGroups,
  setGroupText,
  toggleChecklist,
  toggleOption,
  type DentalGroup,
} from './dental-questionnaire';

const step = (patch: Partial<QuestionnaireStep>): QuestionnaireStep => ({
  step_key: 'dental_reason',
  step_type: 'chip_groups',
  title: null,
  text: null,
  required: true,
  allow_skip: false,
  allow_none: false,
  choices: [],
  options: [],
  groups: [],
  date_min: null,
  date_max: null,
  code: null,
  completed: false,
  truncated: false,
  ai_unavailable: false,
  ...patch,
});

const REASON: DentalGroup = {
  key: 'reason',
  title: null,
  question: 'С чем вы пришли?',
  options: [
    { value: 'pain', label: 'Болит зуб' },
    { value: 'checkup', label: 'Профосмотр' },
    { value: 'other', label: 'Другое' },
  ],
  multiple: true,
  required: true,
  text: {
    placeholder: 'Напишите, с чем пришли',
    required: false,
    show: 'on_other',
  },
};

const SINCE: DentalGroup = {
  key: 'pain.since',
  title: null,
  question: 'Как давно?',
  options: [
    { value: 'today', label: 'Сегодня' },
    { value: 'days', label: 'Несколько дней' },
  ],
  multiple: false,
  required: false,
  text: null,
};

const BLOOD: DentalGroup = {
  key: 'anticoagulants',
  title: 'Вы отметили: разжижающие кровь',
  question: 'Какое лекарство и как принимаете?',
  options: [
    { value: 'eliquis', label: 'Эликвис' },
    { value: 'other', label: 'Другое' },
  ],
  multiple: true,
  required: false,
  text: { placeholder: 'Например: 5 мг', required: false, show: 'on_select' },
};

const MEDS: DentalGroup = {
  key: 'other_meds',
  title: 'Вы отметили: другие лекарства',
  question: 'Какие лекарства и в какой дозе?',
  options: [],
  multiple: true,
  required: false,
  text: {
    placeholder: 'Например: Конкор 5 мг утром',
    required: true,
    show: 'always',
  },
};

describe('dentalScreenFor', () => {
  it('picks a screen by step type', () => {
    expect(dentalScreenFor(step({ step_type: 'chip_groups' }))).toBe('chips');
    expect(dentalScreenFor(step({ step_type: 'checklist' }))).toBe('checklist');
    expect(dentalScreenFor(step({ step_type: 'done', completed: true }))).toBe(
      'done',
    );
    expect(dentalScreenFor(step({ step_type: 'something_new' }))).toBe(
      'unknown',
    );
  });
});

describe('parseGroups', () => {
  it('keeps well-formed groups and drops broken ones', () => {
    const groups = parseGroups(
      step({ groups: [REASON, { key: 'broken' }, 'nonsense', BLOOD] }),
    );

    expect(groups.map((g) => g.key)).toEqual(['reason', 'anticoagulants']);
    expect(groups[0].text?.show).toBe('on_other');
  });

  it('treats unknown text visibility as «after selection»', () => {
    const [group] = parseGroups(
      step({
        groups: [
          {
            ...BLOOD,
            text: { placeholder: 'x', required: false, show: 'weird' },
          },
        ],
      }),
    );

    expect(group.text?.show).toBe('on_select');
  });
});

describe('parseChecklist', () => {
  it('reads rows with hints', () => {
    const items = parseChecklist(
      step({
        step_type: 'checklist',
        choices: [
          {
            value: 'allergy',
            label: 'Аллергия на лекарства',
            hint: 'в том числе на обезболивание',
          },
          { value: 'diabetes', label: 'Сахарный диабет', hint: '' },
        ] as QuestionnaireStep['choices'],
      }),
    );

    expect(items).toEqual([
      {
        value: 'allergy',
        label: 'Аллергия на лекарства',
        hint: 'в том числе на обезболивание',
      },
      { value: 'diabetes', label: 'Сахарный диабет', hint: '' },
    ]);
  });
});

describe('toggleOption', () => {
  it('adds and removes values in a multiple group', () => {
    const once = toggleOption(EMPTY_DRAFT, REASON, 'pain');
    const twice = toggleOption(once, REASON, 'checkup');
    const back = toggleOption(twice, REASON, 'pain');

    expect(twice.selections.reason).toEqual(['pain', 'checkup']);
    expect(back.selections.reason).toEqual(['checkup']);
  });

  it('replaces the value in a single-choice group and unselects on second tap', () => {
    const first = toggleOption(EMPTY_DRAFT, SINCE, 'today');
    const second = toggleOption(first, SINCE, 'days');
    const cleared = toggleOption(second, SINCE, 'days');

    expect(second.selections['pain.since']).toEqual(['days']);
    expect(cleared.selections['pain.since']).toEqual([]);
  });

  it('does not mutate the previous draft', () => {
    toggleOption(EMPTY_DRAFT, REASON, 'pain');

    expect(EMPTY_DRAFT.selections).toEqual({});
  });
});

describe('isTextVisible', () => {
  it('follows the rule sent by the server', () => {
    expect(isTextVisible(MEDS, EMPTY_DRAFT)).toBe(true);
    expect(isTextVisible(BLOOD, EMPTY_DRAFT)).toBe(false);
    expect(
      isTextVisible(BLOOD, toggleOption(EMPTY_DRAFT, BLOOD, 'eliquis')),
    ).toBe(true);
    expect(
      isTextVisible(REASON, toggleOption(EMPTY_DRAFT, REASON, 'pain')),
    ).toBe(false);
    expect(
      isTextVisible(REASON, toggleOption(EMPTY_DRAFT, REASON, 'other')),
    ).toBe(true);
    expect(isTextVisible(SINCE, EMPTY_DRAFT)).toBe(false);
  });
});

describe('groupProblem and canSubmitGroups', () => {
  it('asks to choose when a selection is required', () => {
    expect(groupProblem(REASON, EMPTY_DRAFT)).toBe('choose');
    expect(canSubmitGroups([REASON], EMPTY_DRAFT)).toBe(false);
  });

  it('asks for text when «Другое» is chosen or text is required', () => {
    const other = toggleOption(EMPTY_DRAFT, REASON, 'other');

    expect(groupProblem(REASON, other)).toBe('text');
    expect(groupProblem(REASON, setGroupText(other, 'reason', '   '))).toBe(
      'text',
    );
    expect(
      groupProblem(REASON, setGroupText(other, 'reason', 'брекеты')),
    ).toBeNull();
    expect(groupProblem(MEDS, EMPTY_DRAFT)).toBe('text');
  });

  it('lets optional groups stay empty', () => {
    expect(canSubmitGroups([SINCE, BLOOD], EMPTY_DRAFT)).toBe(true);
  });
});

describe('buildGroupsAnswer', () => {
  it('sends only chosen values and visible, trimmed texts', () => {
    let draft = toggleOption(EMPTY_DRAFT, REASON, 'pain');
    draft = setGroupText(draft, 'reason', 'остался от «Другое»');
    draft = toggleOption(draft, BLOOD, 'eliquis');
    draft = setGroupText(draft, 'anticoagulants', '  5 мг, 2 раза в день ');

    expect(
      buildGroupsAnswer('dental_details', [REASON, SINCE, BLOOD], draft),
    ).toEqual({
      step_key: 'dental_details',
      selections: { reason: ['pain'], anticoagulants: ['eliquis'] },
      texts: { anticoagulants: '5 мг, 2 раза в день' },
    });
  });

  it('clamps long text to the answer limit', () => {
    const draft = setGroupText(EMPTY_DRAFT, 'other_meds', 'а'.repeat(1500));

    expect(draft.texts.other_meds).toHaveLength(1000);
  });
});

describe('skip', () => {
  it('builds a skip answer for the clarifying question', () => {
    expect(buildSkipAnswer('dental_ai')).toEqual({
      step_key: 'dental_ai',
      skip: true,
    });
  });
});

describe('checklist', () => {
  it('toggles rows and answers «none» when nothing is checked', () => {
    const checked = toggleChecklist(toggleChecklist([], 'allergy'), 'diabetes');

    expect(checked).toEqual(['allergy', 'diabetes']);
    expect(toggleChecklist(checked, 'allergy')).toEqual(['diabetes']);
    expect(buildChecklistAnswer('dental_health', [])).toEqual({
      step_key: 'dental_health',
      none: true,
    });
    expect(buildChecklistAnswer('dental_health', checked)).toEqual({
      step_key: 'dental_health',
      selections: { health: ['allergy', 'diabetes'] },
    });
  });
});

describe('dentalProgress', () => {
  it('maps steps to «step N of 3»', () => {
    const at = (current: number, label: string) => ({ current, total: 3, label });

    expect(dentalProgress('dental_reason')).toEqual(at(1, 'Зачем пришли'));
    expect(dentalProgress('dental_pain')).toEqual(at(1, 'Зачем пришли'));
    expect(dentalProgress('dental_health')).toEqual(at(2, 'Здоровье'));
    expect(dentalProgress('dental_details')).toEqual(at(2, 'Уточнение'));
    expect(dentalProgress('dental_mouth')).toEqual(at(3, 'Зубы и дёсны'));
    expect(dentalProgress('dental_ai')).toEqual(at(3, 'Уточнение'));
    expect(dentalProgress('done')).toBeNull();
  });
});

describe('greeting', () => {
  it('greets by name and patronymic', () => {
    expect(inviteGreeting('Ольга', 'Сергеевна')).toBe(
      'Ольга Сергеевна, здравствуйте!',
    );
    expect(inviteGreeting('Игорь', null)).toBe('Игорь, здравствуйте!');
    expect(inviteGreeting(null, null)).toBe('Здравствуйте!');
  });
});

describe('dentalErrorKind', () => {
  it('recognises expired link, stale step and closed subscription', () => {
    expect(dentalErrorKind(new ApiError('gone', 410))).toBe('expired');
    expect(dentalErrorKind(new ApiError('conflict', 409))).toBe('stale');
    expect(
      dentalErrorKind(new ApiError('down', 503, 'subscription_expired')),
    ).toBe('subscription');
    expect(dentalErrorKind(new ApiError('bad', 400))).toBe('rejected');
    expect(dentalErrorKind(new ApiError('token', 401))).toBe('not_found');
    expect(dentalErrorKind(new ApiError('gone', 404))).toBe('not_found');
    expect(dentalErrorKind(new ApiError('server', 500))).toBe('other');
    expect(dentalErrorKind(new Error('offline'))).toBe('other');
  });
});
