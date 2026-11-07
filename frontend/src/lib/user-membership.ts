import type { RoleName } from '@/api';
import type {
  MembershipRole,
  MembershipUpdate,
} from '@/api/user-membership-api';

export function canEditMembership(actor: RoleName, target: RoleName): boolean {
  return actor === 'super_admin' && target !== 'super_admin';
}

export function buildMembershipUpdate(
  clinicId: string,
  role: MembershipRole | null,
  specializations: number[],
): MembershipUpdate | null {
  if (!clinicId) {
    return { clinic_id: null, clinic_role: null, specialization_ids: [] };
  }
  if (!role) return null;
  const doctor = role === 'doctor' || role === 'clinic_admin_doctor';
  if (doctor && !specializations.length) return null;
  return {
    clinic_id: clinicId,
    clinic_role: role,
    specialization_ids: doctor ? specializations : [],
  };
}

export function userDisplayName(user: {
  login: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
}): string {
  return (
    [user.last_name, user.first_name, user.middle_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') || user.login
  );
}

export function membershipHasChanges(
  original: Pick<
    MembershipUpdate,
    'clinic_id' | 'clinic_role' | 'specialization_ids'
  >,
  update: MembershipUpdate | null,
): boolean {
  if (!update) return false;
  return (
    original.clinic_id !== update.clinic_id ||
    original.clinic_role !== update.clinic_role ||
    [...original.specialization_ids].sort((a, b) => a - b).join(',') !==
      [...update.specialization_ids].sort((a, b) => a - b).join(',')
  );
}
