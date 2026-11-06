import { apiClient } from './main-api';
import type { ServiceUserIdRead } from './index';

export type MembershipRole =
  | 'doctor'
  | 'operator'
  | 'clinic_admin'
  | 'clinic_admin_doctor';

export interface MembershipRoleOption {
  value: MembershipRole;
  label: string;
}

export interface UserMembershipRead extends ServiceUserIdRead {
  is_active: boolean;
  clinic_id: string | null;
  clinic_name: string | null;
  membership_id: string | null;
  clinic_role: MembershipRole | null;
  specialization_ids: number[];
}

export interface MembershipUpdate {
  clinic_id: string | null;
  clinic_role: MembershipRole | null;
  specialization_ids: number[];
}

export const userMembershipApi = {
  list: () => apiClient.get<UserMembershipRead[]>('/super-admin/users'),
  roles: () =>
    apiClient.get<MembershipRoleOption[]>('/super-admin/user-membership-roles'),
  update: (userId: string, body: MembershipUpdate) =>
    apiClient.put<UserMembershipRead>(
      '/super-admin/users/' + encodeURIComponent(userId) + '/membership',
      body,
    ),
};
