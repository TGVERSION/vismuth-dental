import { apiClient } from './main-api';
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
  list: (scope: string, query: Record<string, string | number>) =>
    apiClient.get<{
      items: CompletedItem[];
      total: number;
      page: number;
      page_size: number;
    }>(scope, query),
  detail: (scope: string, id: string) =>
    apiClient.get<CompletedDetail>(scope + '/' + id),
  links: (id: string) =>
    apiClient.get<PatientLinks>('/clinics/' + id + '/patient-links'),
};
