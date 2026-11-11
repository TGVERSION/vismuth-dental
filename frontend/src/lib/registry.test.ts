import { describe, expect, it } from 'vitest';
import type { RegistryQuestionnaireItem } from '@/api';
import {
  buildNewLinkPayload,
  formatDateTime,
  groupRegistryByCompletionDay,
  inviteLinkItem,
  patientFullName,
  registryActions,
  registryStatusView,
  registryWhenLine,
} from './registry';

const TZ = 'Asia/Yekaterinburg';

const item = (
  patch: Partial<RegistryQuestionnaireItem>,
): RegistryQuestionnaireItem => ({
  id: 'q1',
  status: 'invited',
  patient_last_name: 'Белова',
  patient_first_name: 'Ольга',
  patient_middle_name: 'Сергеевна',
  created_at: '2026-10-27T10:00:00Z',
  completed_at: null,
  printed_at: null,
  signed_at: null,
  invite_expires_at: '2026-11-03T10:00:00Z',
  ...patch,
});

describe('registryStatusView', () => {
  it('names every status for the front desk', () => {
    expect(registryStatusView('invited').label).toBe('Ссылка отправлена');
    expect(registryStatusView('in_progress').label).toBe('Заполняется');
    expect(registryStatusView('completed').label).toBe('Заполнена');
    expect(registryStatusView('printed').label).toBe('Распечатана');
    expect(registryStatusView('signed').label).toBe('Подписана');
  });
});

describe('patientFullName', () => {
  it('joins surname, name and patronymic', () => {
    expect(patientFullName(item({}))).toBe('Белова Ольга Сергеевна');
    expect(patientFullName(item({ patient_middle_name: null }))).toBe(
      'Белова Ольга',
    );
  });
});

describe('formatDateTime', () => {
  it('formats a timestamp in the given time zone', () => {
    expect(formatDateTime('2026-10-12T15:41:00Z', TZ)).toBe(
      '12.10.2026 в 20:41',
    );
  });
});

describe('registryWhenLine', () => {
  it('shows only the completion date in the display time zone', () => {
    expect(
      registryWhenLine(
        item({ status: 'completed', completed_at: '2026-10-28T21:10:00Z' }),
        TZ,
      ),
    ).toBe('29.10.2026');
  });
  it('has no date line for either active or expired unfinished links', () => {
    expect(registryWhenLine(item({}), TZ)).toBe('');
    expect(
      registryWhenLine(item({ invite_expires_at: '2026-10-01T11:59:00Z' }), TZ),
    ).toBe('');
    expect(registryWhenLine(item({ status: 'in_progress' }), TZ)).toBe('');
  });
});

describe('groupRegistryByCompletionDay', () => {
  it('groups completed items in API order using the same offset as the date filter', () => {
    const newest = item({
      id: 'new',
      status: 'signed',
      completed_at: '2026-11-11T08:00:00Z',
    });
    const sameDay = item({
      id: 'same',
      status: 'printed',
      completed_at: '2026-11-10T20:00:00Z',
    });
    const previousDay = item({
      id: 'older',
      status: 'completed',
      completed_at: '2026-11-10T18:59:59Z',
    });
    expect(
      groupRegistryByCompletionDay(
        [newest, item({}), sameDay, previousDay],
        300,
      ),
    ).toEqual([
      ['2026-11-11', [newest, sameDay]],
      ['2026-11-10', [previousDay]],
    ]);
  });
});

describe('buildNewLinkPayload', () => {
  it('passes the date entered by the administrator without asking the patient', () => {
    expect(buildNewLinkPayload('Белова Ольга Сергеевна', '1985-03-14')).toEqual(
      {
        last_name: 'Белова',
        first_name: 'Ольга',
        middle_name: 'Сергеевна',
        birth_date: '1985-03-14',
      },
    );
  });
  it('trims names and drops an empty patronymic', () => {
    expect(buildNewLinkPayload(' Белова   Ольга ', '')).toEqual({
      last_name: 'Белова',
      first_name: 'Ольга',
      middle_name: null,
    });
  });
  it('requires at least a surname and a given name', () => {
    expect(buildNewLinkPayload('Белова', '')).toBeNull();
    expect(buildNewLinkPayload(' ', '')).toBeNull();
  });
});

describe('inviteLinkItem', () => {
  it('builds a QR card for the new personal link', () => {
    const link = inviteLinkItem({
      ...item({}),
      url: 'https://anketa.example.com/q/i/abc',
    });

    expect(link).toEqual({
      kind: 'invite',
      title: 'Белова Ольга Сергеевна',
      description:
        'Ссылка работает 7 дней. Отправьте её пациенту — она показывается один раз.',
      url: 'https://anketa.example.com/q/i/abc',
      qrText: 'https://anketa.example.com/q/i/abc',
      fileName: 'vismuth-qr-invite-q1.png',
    });
  });
});

describe('registryActions', () => {
  it('allows link actions before completion and print after', () => {
    expect(registryActions('invited')).toEqual({
      canResendLink: true,
      canDelete: true,
      canPrint: false,
    });
    expect(registryActions('in_progress')).toEqual({
      canResendLink: true,
      canDelete: true,
      canPrint: false,
    });
    expect(registryActions('completed')).toEqual({
      canResendLink: false,
      canDelete: false,
      canPrint: true,
    });
    expect(registryActions('printed')).toEqual({
      canResendLink: false,
      canDelete: false,
      canPrint: true,
    });
    expect(registryActions('signed')).toEqual({
      canResendLink: false,
      canDelete: false,
      canPrint: true,
    });
  });
});
