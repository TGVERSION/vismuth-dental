import { describe, expect, it } from 'vitest';
import {
  getSettingsSectionLabel,
  getSettingsSections,
  resolveSettingsSection,
  type SettingsAccess,
} from './settings-sections';

const superAdmin: SettingsAccess = {
  canManageClinics: true,
  canManageUsers: true,
};
const admin: SettingsAccess = { canManageClinics: false, canManageUsers: true };
const doctor: SettingsAccess = {
  canManageClinics: false,
  canManageUsers: false,
};

describe('getSettingsSections', () => {
  it('супер-админу — все разделы, «Клиники» первыми', () => {
    expect(getSettingsSections(superAdmin).map((s) => s.id)).toEqual([
      'clinics',
      'users',
      'protocols',
      'directories',
    ]);
  });

  it('админу — без «Клиник»', () => {
    expect(getSettingsSections(admin).map((s) => s.id)).toEqual([
      'users',
      'protocols',
      'directories',
    ]);
  });

  it('остальным — без «Клиник» и «Пользователей»', () => {
    expect(getSettingsSections(doctor).map((s) => s.id)).toEqual([
      'protocols',
      'directories',
    ]);
  });
});

describe('resolveSettingsSection', () => {
  it('по умолчанию открывает первый доступный раздел', () => {
    expect(resolveSettingsSection(null, superAdmin)).toBe('clinics');
    expect(resolveSettingsSection(null, admin)).toBe('users');
    expect(resolveSettingsSection(null, doctor)).toBe('protocols');
  });

  it('не открывает недоступный раздел, даже если он выбран', () => {
    // Роль могли сменить, пока окно было открыто.
    expect(resolveSettingsSection('clinics', admin)).toBe('users');
    expect(resolveSettingsSection('clinics', doctor)).toBe('protocols');
    expect(resolveSettingsSection('users', doctor)).toBe('protocols');
  });

  it('оставляет выбранный доступный раздел', () => {
    expect(resolveSettingsSection('directories', doctor)).toBe('directories');
    expect(resolveSettingsSection('protocols', superAdmin)).toBe('protocols');
    expect(resolveSettingsSection('users', admin)).toBe('users');
    expect(resolveSettingsSection('clinics', superAdmin)).toBe('clinics');
  });
});

describe('getSettingsSectionLabel', () => {
  it('возвращает подпись раздела', () => {
    expect(getSettingsSectionLabel('users')).toBe('Пользователи');
    expect(getSettingsSectionLabel('clinics')).toBe('Клиники');
  });
});
