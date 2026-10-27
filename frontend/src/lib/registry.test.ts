import { describe, expect, it } from 'vitest';
import type { ClinicMemberRead, RegistryQuestionnaireItem } from '@/api';
import {
  EMPTY_NEW_LINK,
  buildNewLinkPayload,
  doctorOptions,
  inviteLinkItem,
  patientFullName,
  registryActions,
  registryStatusView,
  validateNewLink,
} from './registry';

const member = (patch: Partial<ClinicMemberRead>): ClinicMemberRead => ({
  id: 'm1',
  kind: 'membership',
  status: 'active',
  email: null,
  first_name: 'Дмитрий',
  last_name: 'Смирнов',
  middle_name: 'Андреевич',
  photo_url: null,
  is_clinic_admin: false,
  is_doctor: true,
  specializations: [],
  public_slug: null,
  public_url: null,
  expires_at: null,
  user_id: 'u1',
  ...patch,
});

const item = (patch: Partial<RegistryQuestionnaireItem>): RegistryQuestionnaireItem => ({
  id: 'q1',
  status: 'invited',
  patient_last_name: 'Белова',
  patient_first_name: 'Ольга',
  patient_middle_name: 'Сергеевна',
  doctor_membership_id: 'm1',
  doctor_name: 'Смирнов Д. А.',
  appointment_date: '2026-10-28',
  appointment_time: '14:30',
  created_at: '2026-10-27T10:00:00Z',
  completed_at: null,
  printed_at: null,
  signed_at: null,
  invite_expires_at: '2026-10-30T00:00:00Z',
  ...patch,
});

const TODAY = '2026-10-27';
const FORM = {
  lastName: ' Белова ',
  firstName: 'Ольга',
  middleName: '  ',
  doctorId: 'm1',
  date: '2026-10-28',
  time: '14:30',
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
    expect(patientFullName(item({ patient_middle_name: null }))).toBe('Белова Ольга');
  });
});

describe('doctorOptions', () => {
  it('offers only active doctors, sorted by surname', () => {
    const options = doctorOptions([
      member({ id: 'a', last_name: 'Яковлева', first_name: 'Анна', middle_name: null }),
      member({ id: 'b', is_doctor: false }),
      member({ id: 'c', kind: 'invitation', status: 'invited' }),
      member({ id: 'd', status: 'deactivated' }),
      member({ id: 'e' }),
    ]);

    expect(options).toEqual([
      { value: 'e', label: 'Смирнов Дмитрий Андреевич' },
      { value: 'a', label: 'Яковлева Анна' },
    ]);
  });
});

describe('validateNewLink', () => {
  it('accepts a filled form', () => {
    expect(validateNewLink(FORM, TODAY)).toEqual({});
  });

  it('requires surname, name, doctor, date and time', () => {
    expect(Object.keys(validateNewLink(EMPTY_NEW_LINK, TODAY)).sort()).toEqual(
      ['date', 'doctorId', 'firstName', 'lastName', 'time'],
    );
  });

  it('keeps the date between today and 30 days ahead', () => {
    expect(validateNewLink({ ...FORM, date: '2026-10-26' }, TODAY).date).toBeDefined();
    expect(validateNewLink({ ...FORM, date: '2026-11-27' }, TODAY).date).toContain('30');
    expect(validateNewLink({ ...FORM, date: '2026-11-26' }, TODAY).date).toBeUndefined();
  });

  it('checks the time format', () => {
    expect(validateNewLink({ ...FORM, time: '9:30' }, TODAY).time).toBeDefined();
    expect(validateNewLink({ ...FORM, time: '24:00' }, TODAY).time).toBeDefined();
  });
});

describe('buildNewLinkPayload', () => {
  it('trims names and drops an empty patronymic', () => {
    expect(buildNewLinkPayload(FORM)).toEqual({
      doctor_membership_id: 'm1',
      last_name: 'Белова',
      first_name: 'Ольга',
      middle_name: null,
      appointment_date: '2026-10-28',
      appointment_time: '14:30',
    });
  });
});

describe('inviteLinkItem', () => {
  it('builds a QR card for the new personal link', () => {
    const link = inviteLinkItem({ ...item({}), url: 'https://anketa.example.com/q/i/abc' });

    expect(link).toEqual({
      kind: 'invite',
      title: 'Белова Ольга Сергеевна',
      description: 'Приём 28 октября в 14:30. Отправьте ссылку пациенту — она показывается один раз.',
      url: 'https://anketa.example.com/q/i/abc',
      qrText: 'https://anketa.example.com/q/i/abc',
      fileName: 'vismuth-qr-invite-q1.png',
    });
  });
});

describe('registryActions', () => {
  it('allows link actions before completion and print/sign after', () => {
    expect(registryActions('invited')).toEqual({ canResendLink: true, canDelete: true, canPrint: false, canMarkSigned: false });
    expect(registryActions('in_progress')).toEqual({ canResendLink: true, canDelete: true, canPrint: false, canMarkSigned: false });
    expect(registryActions('completed')).toEqual({ canResendLink: false, canDelete: false, canPrint: true, canMarkSigned: true });
    expect(registryActions('printed')).toEqual({ canResendLink: false, canDelete: false, canPrint: true, canMarkSigned: true });
    expect(registryActions('signed')).toEqual({ canResendLink: false, canDelete: false, canPrint: true, canMarkSigned: false });
  });
});
