import { describe, expect, it } from 'vitest';
import { roleFlags, staffRole } from './staff-role';

describe('единая роль сотрудника', () => {
  it('назначение регистратора снимает врачебные и административные права', () => {
    expect(roleFlags('operator')).toEqual({
      is_operator: true,
      is_doctor: false,
      is_clinic_admin: false,
    });
    expect(staffRole(roleFlags('operator'))).toBe('operator');
  });
  it('комбинированная роль сохраняет оба права, а админ не становится врачом', () => {
    expect(roleFlags('clinic_admin_doctor')).toEqual({
      is_operator: false,
      is_doctor: true,
      is_clinic_admin: true,
    });
    expect(staffRole(roleFlags('clinic_admin_doctor'))).toBe(
      'clinic_admin_doctor',
    );
    expect(roleFlags('clinic_admin').is_doctor).toBe(false);
  });
});
