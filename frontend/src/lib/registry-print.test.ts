import { describe, expect, it } from 'vitest';
import type { RegistryQuestionnaireDetail } from '@/api';
import { ATTESTATION, printSheet } from './registry-print';

const detail = (
  patch: Partial<RegistryQuestionnaireDetail> = {},
): RegistryQuestionnaireDetail => ({
  id: 'q1',
  status: 'completed',
  patient_last_name: 'Белова',
  patient_first_name: 'Ольга',
  patient_middle_name: 'Сергеевна',
  created_at: '2026-10-12T10:00:00Z',
  completed_at: '2026-10-12T15:41:00Z',
  printed_at: null,
  signed_at: null,
  invite_expires_at: '2026-10-19T10:00:00Z',
  structured: {
    important: [
      'Принимает Эликвис, 5 мг, 2 раза в день: риск кровотечения при удалении и хирургии',
      'Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд',
    ],
    important_facts: [
      'Принимает Эликвис, 5 мг, 2 раза в день',
      'Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд',
    ],
    complaints:
      'Болит зуб снизу справа: от холодного, при накусывании; несколько дней.',
    health: [
      {
        key: 'allergy',
        label: 'Аллергия на лекарства',
        has: true,
        detail: 'Антибиотики; амоксициллин; Сыпь, зуд',
      },
      { key: 'diabetes', label: 'Сахарный диабет', has: false, detail: '' },
    ],
    clarifications: [
      {
        question: 'Когда последний раз принимали Эликвис?',
        answer: 'Сегодня утром',
      },
      { question: 'Была ли температура?', answer: '' },
    ],
  },
  gaps: [
    { section: 'medications', question: 'По какому поводу назначен Эликвис' },
  ],
  ...patch,
});

describe('printSheet', () => {
  it('builds the A4 sheet from the card', () => {
    const sheet = printSheet(detail(), 'Здоровье', 'Asia/Yekaterinburg');

    expect(sheet).toEqual({
      clinicName: 'Здоровье',
      filled: 'Заполнена 12.10.2026 в 20:41',
      patient: 'Белова Ольга Сергеевна',
      important: [
        'Принимает Эликвис, 5 мг, 2 раза в день',
        'Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд',
      ],
      complaints:
        'Болит зуб снизу справа: от холодного, при накусывании; несколько дней.',
      health: [
        {
          label: 'Аллергия на лекарства',
          has: true,
          detail: 'Антибиотики; амоксициллин; Сыпь, зуд',
        },
        { label: 'Сахарный диабет', has: false, detail: '' },
      ],
      clarifications: [
        {
          question: 'Когда последний раз принимали Эликвис?',
          answer: 'Сегодня утром',
        },
        { question: 'Была ли температура?', answer: 'Пациент не ответил' },
      ],
      attestation: ATTESTATION,
    });
  });

  it('like a paper dental form, names neither the doctor nor the appointment', () => {
    const sheet = printSheet(detail(), 'Здоровье', 'UTC');

    expect(Object.keys(sheet)).not.toContain('doctor');
    expect(Object.keys(sheet)).not.toContain('appointment');
  });

  it('has the usual statements of a dental health form', () => {
    expect(ATTESTATION).toEqual([
      'Я ответил(а) на вопросы анкеты сам(а) и правдиво.',
      'Мне известно, что результат лечения зависит от состояния моего здоровья.',
      'Если состояние здоровья изменится или я начну принимать новые лекарства, я сообщу об этом врачу.',
    ]);
  });

  it('does not put doctor prompts or warnings on the sheet the patient signs', () => {
    const sheet = JSON.stringify(printSheet(detail(), 'Здоровье', 'UTC'));

    expect(sheet).not.toContain('По какому поводу');
    expect(sheet).not.toContain('риск кровотечения');
  });

  it('is empty-safe when the card is not built yet', () => {
    const sheet = printSheet(
      detail({ structured: null, completed_at: null }),
      'Здоровье',
      'UTC',
    );

    expect(sheet.filled).toBe('');
    expect(sheet.important).toEqual([]);
    expect(sheet.health).toEqual([]);
    expect(sheet.complaints).toBe('');
    expect(sheet.clarifications).toEqual([]);
  });
});
