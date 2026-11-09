import { apiClient } from './main-api';
import type { RequestOptions } from './base-client';
import type {
  DoctorQuestionnaireListItem,
  DoctorQuestionnaireDetail,
  SpecializationRead,
} from './index';
export interface CompletedMeta {
  clinic_id: string;
  clinic_name: string;
  kind: 'general' | 'gastro' | 'dental';
  completed_at: string | null;
  printed_at: string | null;
  signed_at: string | null;
}
export type CompletedItem = DoctorQuestionnaireListItem & CompletedMeta;
export type CompletedDetail = DoctorQuestionnaireDetail & CompletedMeta;
export interface PatientLinkRequest {
  doctor_membership_id?: string;
  appointment_date?: string;
  appointment_time?: string;
}
export interface PatientLinks {
  clinic_id: string;
  clinic_name: string;
  clinic_public_url: string | null;
  doctors: {
    membership_id: string;
    first_name: string | null;
    last_name: string | null;
    middle_name: string | null;
    public_url: string;
    specializations: SpecializationRead[];
  }[];
}
export const completedApi = {
  list: (
    scope: string,
    query: Record<string, string | number>,
    options?: RequestOptions,
  ) =>
    apiClient.get<{
      items: CompletedItem[];
      total: number;
      page: number;
      page_size: number;
    }>(scope, query, options),
  detail: (scope: string, id: string) =>
    apiClient.get<CompletedDetail>(scope + '/' + id),
  links: (id: string) =>
    apiClient.get<PatientLinks>('/clinics/' + id + '/patient-links'),
  createLink: (id: string, data: PatientLinkRequest) =>
    apiClient.post<{ url: string }>('/clinics/' + id + '/patient-links', data),
};
