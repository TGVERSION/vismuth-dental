export { mainApi } from './main-api';
export { mlApi } from './ml-api';

export interface ApiError {
  detail: string;
}

//ML
export interface CompletePayload {
  field_name: string;
  prefix: string;
  num_sequences: number;
}

export interface CompleteResponse {
  suggestions: string[];
}

export interface MlMkbCodePayload {
  field_name: string;
  description: string;
  n_candidates: number;
  use_llm: boolean;
}

export interface MlMkbCodeResponse {
  extracted_diagnosis: string;
  candidates: CandidatesItem[];
  best_code: string;
  best_name: string;
}

export interface CandidatesItem {
  code: string;
  name: string;
  distance: number;
  similarity: number;
}

export interface MlStatusPayload {
  field_name: string;
  description: string;
  selected_text: string;
  n_candidates: number;
  event_type: string;
}

export interface MlStatusResponse {
  detail: string;
}

export interface mlFullnessComplaintPayload {
  example_prompt: string;
}

export interface mlFullnessComplaintResponse {
  status: 'complete' | 'incomplete';
  color: 'green' | 'yellow' | 'red';
  analysis: string;
  suggested_text: string;
}

//Main
export interface ConsultationsRequest {
  id: string;
  external_system: number;
  external_patient_id: number;
  external_doctor_id: number;
  external_visit_id: number;
  consultation_datetime: string;
  complaints: string;
  disease_anamnesis: string;
  disease_history: string;
  patient_condition: string;
  life_anamnesis: string;
  bad_habits: string;
  allergy_anamnesis: string;
  vital_parameters: string;
  objective_data: string;
  clinical_assessment: string;
  consultation_conclusion: string;
  main_diagnosis: string;
  comorbid_diagnoses: string;
  recommendations: string;
  prescriptions: string;
  status_protocol: string;
}
export interface ConsultationsResponse extends ConsultationsRequest {
  deleted_at: string;
  created_at: string;
  updated_at: string;
}

export interface ListConsultationsResponse {
  id: string;
  updated_at: string;
  protocol_name: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}
export interface LoginResponse {
  detail: string;
}

export interface RegisterConfirmRequest {
  login: string;
  code: string;
}
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: ServiceUserData;
}

export interface ServiceUserData {
  id?: string;
  login: string;
  first_name: string;
  last_name: string;
  role: 'doctor' | 'head_of_department' | 'administrator';
  is_active: true;
  created_at: string;
  updated_at: string;
  deleted_at: string;
}

export interface Mkb10Item {
  code: string;
  name: string;
}
export interface Mkb10Response {
  page: number;
  size: number;
  totalCount: number;
  items: Mkb10Item[];
}
export interface Mkb10Request {
  page: number;
  size: number;
  searchValue?: string;
}

export interface ListsGroupsResponse {
  id: string;
  group_name: string;
}

export interface GroupRequest {
  group_name: string;
}

export interface GroupResponse extends ListsGroupsResponse {
  creator_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
}

export interface ListsTemplatesResponse {
  id: string;
  protocol_name: string;
  group_id: string;
  privacy: string;
}

export interface TemplatesRequest {
  protocol_name: string;
  group_id: string | null;
  privacy: string;
  fields: FieldsType[];
}

export interface FieldsType {
  field_name: string;
  field_type: string;
  field_value: string;
}

export interface FieldsTypeFull extends FieldsType {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
}

export interface TemplatesResponse {
  id: string;
  protocol_name: string;
  group_id: string;
  creator_id: string;
  privacy: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  fields: FieldsTypeFull[];
}
