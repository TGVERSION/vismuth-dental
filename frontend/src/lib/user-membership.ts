import type { RoleName } from '@/api';
import type {
  MembershipRole,
  MembershipUpdate,
} from '@/api/user-membership-api';

export function canEditMembership(actor: RoleName, target: RoleName): boolean {
  return actor === 'super_admin' && target === 'doctor';
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
