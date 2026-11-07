import type { MembershipRole } from '@/api/user-membership-api';

export function roleFlags(role: MembershipRole) {
  return {
    is_clinic_admin: role === 'clinic_admin' || role === 'clinic_admin_doctor',
    is_doctor: role === 'doctor' || role === 'clinic_admin_doctor',
    is_operator: role === 'operator',
  };
}

export function staffRole(flags: {
  is_clinic_admin: boolean;
  is_doctor: boolean;
  is_operator?: boolean;
}): MembershipRole {
  return flags.is_clinic_admin
    ? flags.is_doctor
      ? 'clinic_admin_doctor'
      : 'clinic_admin'
    : flags.is_doctor
      ? 'doctor'
      : 'operator';
}

export function memberRoleValues(
  role: MembershipRole,
): ('admin' | 'doctor' | 'operator')[] {
  const flags = roleFlags(role);
  return [
    ...(flags.is_clinic_admin ? ['admin' as const] : []),
    ...(flags.is_doctor ? ['doctor' as const] : []),
    ...(flags.is_operator ? ['operator' as const] : []),
  ];
}

export function roleFromValues(
  roles: ('admin' | 'doctor' | 'operator')[],
): MembershipRole {
  return staffRole({
    is_clinic_admin: roles.includes('admin'),
    is_doctor: roles.includes('doctor'),
    is_operator: roles.includes('operator'),
  });
}
