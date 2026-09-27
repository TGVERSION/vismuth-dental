import { describe, expect, it } from 'vitest';
import {
  getSettingsSectionLabel,
  getSettingsSections,
  resolveSettingsSection,
} from './settings-sections';

describe('getSettingsSections', () => {
  it('показывает «Пользователей» тем, кто может ими управлять', () => {
    expect(getSettingsSections(true).map((s) => s.id)).toEqual([
      'users',
      'protocols',
      'directories',
    ]);
  });

  it('прячет «Пользователей» от остальных', () => {
    expect(getSettingsSections(false).map((s) => s.id)).toEqual([
      'protocols',
      'directories',
    ]);
  });
});

describe('resolveSettingsSection', () => {
  it('по умолчанию открывает «Пользователей» для админа', () => {
    expect(resolveSettingsSection(null, true)).toBe('users');
  });

  it('по умолчанию открывает «Структуры протоколов» для остальных', () => {
    expect(resolveSettingsSection(null, false)).toBe('protocols');
  });

  it('не открывает «Пользователей» без прав, даже если раздел выбран', () => {
    // Роль могли снять, пока окно было открыто.
    expect(resolveSettingsSection('users', false)).toBe('protocols');
  });

  it('оставляет выбранный доступный раздел', () => {
    expect(resolveSettingsSection('directories', false)).toBe('directories');
    expect(resolveSettingsSection('protocols', true)).toBe('protocols');
    expect(resolveSettingsSection('users', true)).toBe('users');
  });
});

describe('getSettingsSectionLabel', () => {
  it('возвращает подпись раздела', () => {
    expect(getSettingsSectionLabel('users')).toBe('Пользователи');
  });
});
