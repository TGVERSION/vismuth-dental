import type { MembershipRole } from './user-membership-api';
import { ApiClient, type RequestOptions } from './base-client';
import { apiClient } from './main-api';
import type { SpecializationRead, TokenResponse } from './index';
const publicClient = new ApiClient({
  baseUrl: '/api/main',
  auth: false,
  retries: 0,
});
export interface JoinRequest {
  id: string;
  clinic_id: string;
  clinic_name: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  requested_role: MembershipRole;
  requested_role_label?: string;
  specialization_ids: number[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}
export interface JoinState {
  restricted: boolean;
  requests: JoinRequest[];
}
export interface JoinPreview {
  clinic_id: string;
  clinic_name: string;
  roles: { value: MembershipRole; label: string }[];
  specializations: SpecializationRead[];
}
export interface JoinSelection {
  token: string;
  requested_role: MembershipRole;
  specialization_ids: number[];
}
export const clinicJoinApi = {
  preview: (token: string) =>
    publicClient.get<JoinPreview>(
      '/auth/clinic-join/' + encodeURIComponent(token),
    ),
  register: (
    data: JoinSelection & {
      login: string;
      password: string;
      first_name: string;
      last_name: string;
      middle_name?: string;
    },
  ) => publicClient.post('/auth/clinic-join/register', data),
  confirm: (login: string, code: string) =>
    publicClient.post<TokenResponse>('/auth/clinic-join/confirm', {
      login,
      code,
    }),
  submit: (data: JoinSelection) =>
    apiClient.post<JoinRequest>('/clinic-join/requests', data),
  me: (options?: RequestOptions) =>
    apiClient.get<JoinState>('/clinic-join/me', undefined, options),
  link: (id: string) =>
    apiClient.get<{ active: boolean }>(
      '/super-admin/clinics/' + id + '/join-link',
    ),
  issue: (id: string) =>
    apiClient.post<{ active: boolean; url: string }>(
      '/super-admin/clinics/' + id + '/join-link',
    ),
  disable: (id: string) =>
    apiClient.delete('/super-admin/clinics/' + id + '/join-link'),
  requests: (params: {
    clinic_id?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<{ items: JoinRequest[]; total: number }>(
      '/super-admin/join-requests',
      params,
    ),
  decide: (id: string, decision: 'approve' | 'reject') =>
    apiClient.post<JoinRequest>(
      '/super-admin/join-requests/' + id + '/' + decision,
    ),
};
