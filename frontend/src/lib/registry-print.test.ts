import { describe, expect, it } from 'vitest';
import type { RegistryQuestionnaireDetail } from '@/api';
import { ATTESTATION, formatDate, formatDateTime, printSheet } from './registry-print';

const detail = (patch: Partial<RegistryQuestionnaireDetail> = {}): RegistryQuestionnaireDetail => ({
  id: 'q1',
  status: 'completed',
  patient_last_name: 'Белова',
  patient_first_name: 'Ольга',
  patient_middle_name: 'Сергеевна',
  doctor_membership_id: 'm1',
  doctor_name: 'Смирнов Д. А.',
  appointment_date: '2026-10-14',
  appointment_time: '14:30',
  created_at: '2026-10-12T10:00:00Z',
  completed_at: '2026-10-12T15:41:00Z',
  printed_at: null,
  signed_at: null,
  invite_expires_at: '2026-10-16T00:00:00Z',
  structured: {
    important: [
      'Принимает Эликвис, 5 мг, 2 раза в день: риск кровотечения при удалении и хирургии',
      'Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд',
    ],
    important_facts: [
      'Принимает Эликвис, 5 мг, 2 раза в день',
      'Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд',
    ],
    complaints: 'Болит зуб снизу справа: от холодного, при накусывании; несколько дней.',
    health: [
      { key: 'allergy', label: 'Аллергия на лекарства', has: true, detail: 'Антибиотики; амоксициллин; Сыпь, зуд' },
      { key: 'diabetes', label: 'Сахарный диабет', has: false, detail: '' },
    ],
  },
  gaps: ['По какому поводу назначен Эликвис'],
  ...patch,
});

describe('dates', () => {
  it('formats the appointment date without time zone shifts', () => {
    expect(formatDate('2026-10-14')).toBe('14.10.2026');
    expect(formatDate(null)).toBe('');
  });

  it('formats a timestamp in the given time zone', () => {
    expect(formatDateTime('2026-10-12T15:41:00Z', 'Asia/Yekaterinburg')).toBe('12.10.2026 в 20:41');
  });
});

describe('printSheet', () => {
  it('builds the A4 sheet from the card', () => {
    const sheet = printSheet(detail(), 'Здоровье', 'Asia/Yekaterinburg');

    expect(sheet).toEqual({
      clinicName: 'Здоровье',
      filled: 'Заполнена 12.10.2026 в 20:41',
      patient: 'Белова Ольга Сергеевна',
      doctor: 'Смирнов Д. А.',
      appointment: '14.10.2026, 14:30',
      important: [
        'Принимает Эликвис, 5 мг, 2 раза в день',
        'Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд',
      ],
      complaints: 'Болит зуб снизу справа: от холодного, при накусывании; несколько дней.',
      health: [
        { label: 'Аллергия на лекарства', has: true, detail: 'Антибиотики; амоксициллин; Сыпь, зуд' },
        { label: 'Сахарный диабет', has: false, detail: '' },
      ],
      attestation: ATTESTATION,
    });
  });

  it('does not put doctor prompts or warnings on the sheet the patient signs', () => {
    const sheet = JSON.stringify(printSheet(detail(), 'Здоровье', 'UTC'));

    expect(sheet).not.toContain('По какому поводу');
    expect(sheet).not.toContain('риск кровотечения');
  });

  it('is empty-safe when the card is not built yet', () => {
    const sheet = printSheet(detail({ structured: null, completed_at: null }), 'Здоровье', 'UTC');

    expect(sheet.filled).toBe('');
    expect(sheet.important).toEqual([]);
    expect(sheet.health).toEqual([]);
    expect(sheet.complaints).toBe('');
  });
});
