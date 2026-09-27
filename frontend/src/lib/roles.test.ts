import { describe, expect, it } from 'vitest';
import type { RoleRead } from '@/api';
import {
  buildRoleOptions,
  canDeleteUser,
  canEditUserRole,
  isPrivilegedRole,
} from './roles';

const roles: RoleRead[] = [
  { name: 'super_admin', name_ru: 'Супер-администратор' },
  { name: 'admin', name_ru: 'Администратор' },
  { name: 'doctor', name_ru: 'Врач' },
  { name: 'patient', name_ru: 'Пациент' },
];

describe('isPrivilegedRole', () => {
  it('признаёт super_admin и admin', () => {
    expect(isPrivilegedRole('super_admin')).toBe(true);
    expect(isPrivilegedRole('admin')).toBe(true);
  });

  it('не признаёт врача и пациента', () => {
    expect(isPrivilegedRole('doctor')).toBe(false);
    expect(isPrivilegedRole('patient')).toBe(false);
  });

  it('не признаёт устаревшие коды из localStorage', () => {
    expect(isPrivilegedRole('administrator')).toBe(false);
    expect(isPrivilegedRole('head_of_department')).toBe(false);
  });

  it('не признаёт пустую роль', () => {
    expect(isPrivilegedRole(null)).toBe(false);
    expect(isPrivilegedRole(undefined)).toBe(false);
    expect(isPrivilegedRole('')).toBe(false);
  });
});

describe('buildRoleOptions', () => {
  it('берёт коды и подписи из справочника в его порядке, без пациента', () => {
    expect(buildRoleOptions(roles, { role: 'doctor' })).toEqual([
      { value: 'super_admin', label: 'Супер-администратор' },
      { value: 'admin', label: 'Администратор' },
      { value: 'doctor', label: 'Врач' },
    ]);
  });

  it('показывает пациента, если это текущая роль', () => {
    const options = buildRoleOptions(roles, { role: 'patient' });
    expect(options.map((o) => o.value)).toContain('patient');
  });

  it('при пустом справочнике оставляет только текущую роль с её подписью', () => {
    expect(
      buildRoleOptions([], { role: 'admin', role_name_ru: 'Администратор' }),
    ).toEqual([{ value: 'admin', label: 'Администратор' }]);
  });

  it('добавляет неизвестную роль, чтобы не показывать «Выберите...»', () => {
    const options = buildRoleOptions(roles, { role: 'administrator' });
    expect(options[options.length - 1]).toEqual({
      value: 'administrator',
      label: 'administrator',
    });
  });

  it('не дублирует текущую роль, если она есть в справочнике', () => {
    const options = buildRoleOptions(roles, {
      role: 'admin',
      role_name_ru: 'Администратор',
    });
    expect(options.filter((o) => o.value === 'admin')).toHaveLength(1);
  });
});

describe('canEditUserRole / canDeleteUser', () => {
  it('разрешает админу и супер-админу менять чужие строки', () => {
    const base = { actorId: 'me', targetId: 'other' };
    expect(canEditUserRole({ ...base, actorRole: 'admin' })).toBe(true);
    expect(canEditUserRole({ ...base, actorRole: 'super_admin' })).toBe(true);
    expect(canDeleteUser({ ...base, actorRole: 'admin' })).toBe(true);
  });

  it('запрещает свою строку', () => {
    const params = { actorId: 'me', actorRole: 'admin', targetId: 'me' };
    expect(canEditUserRole(params)).toBe(false);
    expect(canDeleteUser(params)).toBe(false);
  });

  it('при неизвестном id актора запрещает всё', () => {
    const params = { actorId: undefined, actorRole: 'admin', targetId: 'x' };
    expect(canEditUserRole(params)).toBe(false);
    expect(canDeleteUser(params)).toBe(false);
  });

  it('запрещает непривилегированным и устаревшим ролям', () => {
    const base = { actorId: 'me', targetId: 'other' };
    expect(canEditUserRole({ ...base, actorRole: 'doctor' })).toBe(false);
    expect(canEditUserRole({ ...base, actorRole: 'administrator' })).toBe(
      false,
    );
  });
});
