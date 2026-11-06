import { describe, expect, it } from 'vitest';
import {
  buildMembershipUpdate,
  canEditMembership,
  membershipHasChanges,
  userDisplayName,
} from './user-membership';

describe('назначение клиники пользователю', () => {
  it('не предлагает операторскую роль аккаунту с платформенными привилегиями', () => {
    expect(canEditMembership('super_admin', 'doctor')).toBe(true);
    expect(canEditMembership('admin', 'doctor')).toBe(false);
    expect(canEditMembership('super_admin', 'admin')).toBe(false);
    expect(canEditMembership('super_admin', 'super_admin')).toBe(false);
  });

  it('при выборе оператора удаляет врачебные специализации из запроса', () => {
    expect(buildMembershipUpdate('clinic-2', 'operator', [1, 2])).toEqual({
      clinic_id: 'clinic-2',
      clinic_role: 'operator',
      specialization_ids: [],
    });
  });

  it('не сохраняет врача без выбранной специализации', () => {
    expect(buildMembershipUpdate('clinic-2', 'doctor', [])).toBeNull();
    expect(buildMembershipUpdate('clinic-2', 'doctor', [4])).toEqual({
      clinic_id: 'clinic-2',
      clinic_role: 'doctor',
      specialization_ids: [4],
    });
    expect(
      buildMembershipUpdate('clinic-2', 'clinic_admin_doctor', []),
    ).toBeNull();
  });

  it('явное отключение клиники очищает роль и специализации', () => {
    expect(buildMembershipUpdate('', 'doctor', [4])).toEqual({
      clinic_id: null,
      clinic_role: null,
      specialization_ids: [],
    });
    expect(buildMembershipUpdate('clinic-2', null, [])).toBeNull();
  });
});

describe('карточка пользователя', () => {
  it('показывает ФИО, а при отсутствии имени — почту', () => {
    expect(
      userDisplayName({
        login: 'user@example.test',
        first_name: ' Иван ',
        last_name: ' Петров ',
        middle_name: 'Иванович',
      }),
    ).toBe('Петров Иван Иванович');
    expect(
      userDisplayName({
        login: 'user@example.test',
        first_name: ' ',
        last_name: null,
      }),
    ).toBe('user@example.test');
  });

  it('не предлагает сохранять неизменённое членство из-за порядка специализаций', () => {
    const original = {
      clinic_id: 'clinic-1',
      clinic_role: 'doctor' as const,
      specialization_ids: [2, 1],
    };
    expect(
      membershipHasChanges(original, {
        ...original,
        specialization_ids: [1, 2],
      }),
    ).toBe(false);
    expect(
      membershipHasChanges(original, {
        clinic_id: 'clinic-2',
        clinic_role: 'operator',
        specialization_ids: [],
      }),
    ).toBe(true);
    expect(membershipHasChanges(original, null)).toBe(false);
  });
});
