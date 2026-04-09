export { mainApi } from './main-api';
export { mlApi } from './ml-api';
export { templateApi } from './template-api';

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
  candidates: string[];
  best_code: string;
  best_name: string;
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
  user: UserData;
}

export interface UserData {
  id: string;
  role: string;
  login: string;
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

export interface TemplateGroup {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  templates?: Template[];
  isExpanded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  groupId?: string | null;
  content?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateListResponse {
  groups: TemplateGroup[];
  templates: Template[];
}
