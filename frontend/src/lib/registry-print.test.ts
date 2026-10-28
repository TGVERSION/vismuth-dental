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
    expect(JSON.stringify(printSheet(detail()))).not.toContain('риск кровотечения');
  });
});
