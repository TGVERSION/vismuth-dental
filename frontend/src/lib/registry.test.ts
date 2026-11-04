import { describe, expect, it } from 'vitest';
import type { RegistryQuestionnaireItem } from '@/api';
import {
  EMPTY_NEW_LINK,
  buildNewLinkPayload,
  formatDateTime,
  inviteLinkItem,
  patientFullName,
  registryActions,
  registryStatusView,
  registryWhenLine,
  validateNewLink,
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

const FORM = {
  lastName: ' Белова ',
  firstName: 'Ольга',
  middleName: '  ',
};

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
  const now = new Date('2026-10-28T12:00:00Z');

  it('shows when the questionnaire was filled', () => {
    expect(
      registryWhenLine(
        item({ status: 'completed', completed_at: '2026-10-28T05:10:00Z' }),
        now,
        TZ,
      ),
    ).toBe('Заполнена 28.10.2026 в 10:10');
  });

  it('shows until when the link works', () => {
    expect(registryWhenLine(item({}), now, TZ)).toBe(
      'Ссылка действует до 03.11.2026 в 15:00',
    );
  });

  it('says the link is outdated after the deadline', () => {
    expect(
      registryWhenLine(
        item({ invite_expires_at: '2026-10-28T11:59:00Z' }),
        now,
        TZ,
      ),
    ).toBe('Ссылка устарела');
  });
});

describe('validateNewLink', () => {
  it('accepts surname and name', () => {
    expect(validateNewLink(FORM)).toEqual({});
  });

  it('requires surname and name only', () => {
    expect(Object.keys(validateNewLink(EMPTY_NEW_LINK)).sort()).toEqual([
      'firstName',
      'lastName',
    ]);
  });
});

describe('buildNewLinkPayload', () => {
  it('passes the date entered by the administrator without asking the patient', () => {
    expect(buildNewLinkPayload({ ...FORM, birthDate: '1985-03-14' })).toMatchObject({
      birth_date: '1985-03-14',
    });
  });
  it('trims names and drops an empty patronymic', () => {
    expect(buildNewLinkPayload(FORM)).toEqual({
      last_name: 'Белова',
      first_name: 'Ольга',
      middle_name: null,
    });
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
  it('allows link actions before completion and print/sign after', () => {
    expect(registryActions('invited')).toEqual({
      canResendLink: true,
      canDelete: true,
      canPrint: false,
      canMarkSigned: false,
    });
    expect(registryActions('in_progress')).toEqual({
      canResendLink: true,
      canDelete: true,
      canPrint: false,
      canMarkSigned: false,
    });
    expect(registryActions('completed')).toEqual({
      canResendLink: false,
      canDelete: false,
      canPrint: true,
      canMarkSigned: true,
    });
    expect(registryActions('printed')).toEqual({
      canResendLink: false,
      canDelete: false,
      canPrint: true,
      canMarkSigned: true,
    });
    expect(registryActions('signed')).toEqual({
      canResendLink: false,
      canDelete: false,
      canPrint: true,
      canMarkSigned: false,
    });
  });
});
