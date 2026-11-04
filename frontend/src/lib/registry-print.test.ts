import { describe, expect, it } from 'vitest';
import type { DentalPaperForm, RegistryQuestionnaireDetail } from '@/api';
import { printSheet } from './registry-print';

const FORM: DentalPaperForm = {
  birth_date: '14.03.1985',
  visit_year: '2024',
  visit_clinic: 'Улыбка',
  more: '',
  problems: [{ letter: 'а', text: 'лечение зубов', selected: true }],
  rows: [
    {
      number: 1,
      text: 'Вирусный гепатит',
      answer: false,
      note_label: 'Если да, то какого типа и когда',
      note: '',
      underline: [],
      subs: [],
    },
  ],
};

const detail = (
  patch: Partial<RegistryQuestionnaireDetail> = {},
): RegistryQuestionnaireDetail => ({
  id: 'q1',
  status: 'completed',
  patient_last_name: ' Белова ',
  patient_first_name: 'Ольга',
  patient_middle_name: 'Сергеевна',
  created_at: '2026-10-12T10:00:00Z',
  completed_at: '2026-10-12T15:41:00Z',
  printed_at: null,
  signed_at: null,
  invite_expires_at: '2026-10-19T10:00:00Z',
  structured: {
    important: ['Принимает Эликвис: риск кровотечения при удалении и хирургии'],
    paper_form: FORM,
  },
  gaps: [],
  ...patch,
});

describe('printSheet', () => {
  it('puts the patient name over the filled paper form', () => {
    expect(printSheet(detail())).toEqual({
      lastName: 'Белова',
      firstMiddle: 'Ольга Сергеевна',
      form: FORM,
      continuation: [],
    });
  });

  it('drops an empty patronymic', () => {
    expect(printSheet(detail({ patient_middle_name: null }))?.firstMiddle).toBe(
      'Ольга',
    );
  });

  it('has nothing to print without the form', () => {
    expect(printSheet(detail({ structured: { important: [] } }))).toBeNull();
    expect(printSheet(detail({ structured: null }))).toBeNull();
  });

  it('does not put doctor warnings on the sheet the patient signs', () => {
    expect(JSON.stringify(printSheet(detail()))).not.toContain(
      'риск кровотечения',
    );
  });

  it('keeps a long answer complete on a labelled continuation without changing stored data', () => {
    const longAnswer = 'Пациент сообщил точные сведения. '.repeat(40);
    const original = {
      ...FORM,
      more: longAnswer,
      rows: [{ ...FORM.rows[0], answer: true, note: longAnswer }],
    };
    const result = printSheet(detail({ structured: { paper_form: original } }));
    expect(result?.continuation).toEqual([
      { label: 'Пункт 1. Если да, то какого типа и когда', text: longAnswer },
      { label: 'Дополнительные сведения пациента', text: longAnswer },
    ]);
    expect(result?.form.rows[0].note).toContain('продолжени');
    expect(result?.form.more).toContain('продолжени');
    expect(original.more).toBe(longAnswer);
    expect(original.rows[0].note).toBe(longAnswer);
  });

  it('moves long named allergen notes to a continuation, retaining their category', () => {
    const note = 'Подробное описание реакции '.repeat(30);
    const form = {
      ...FORM,
      rows: [
        {
          ...FORM.rows[0],
          number: 41,
          note_label: null,
          subs: [{ text: 'антибиотики', answer: true, note }],
        },
      ],
    };
    const result = printSheet(detail({ structured: { paper_form: form } }));
    expect(result?.continuation[0]).toEqual({
      label: 'Пункт 41. антибиотики',
      text: note,
    });
    expect(result?.form.rows[0].subs[0].answer).toBe(true);
  });

  it('preserves an unknown answer as a blank mark rather than a negative', () => {
    const form = { ...FORM, rows: [{ ...FORM.rows[0], answer: null }] };
    expect(
      printSheet(detail({ structured: { paper_form: form } }))?.form.rows[0]
        .answer,
    ).toBeNull();
  });
});
