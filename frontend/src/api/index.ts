export { mainApi } from './main-api';
export { mlApi } from './ml-api';

export interface ApiError {
  detail: string;
}

// Enums
export type AutocompleteType = 'ml_autocomplete' | 'dict_autocomplete';
export type MkbEventType = 'form_click' | 'autocomplete_shown' | 'suggestion_selected';
export type ProtocolPrivacy = 'general' | 'personal';

//ML
export interface CompletePayload {
  field_name?: string | null;
  prefix: string;
  suggestions_count?: number;
  type_autocomplete?: AutocompleteType;
}

export interface CompleteResponse {
  suggestions: string[];
}

export interface MlMkbCodePayload {
  field_name: string;
  description: string;
  n_candidates?: number;
  use_llm?: boolean;
}

export interface MlMkbCodeResponse {
  extracted_diagnosis: string | null;
  candidates: Record<string, unknown>[];
  best_code: string | null;
  best_name: string | null;
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
  n_candidates: number;
  selected_text?: string | null;
  event_type: MkbEventType;
  type_autocomplete?: AutocompleteType;
}

export interface MlStatusResponse {
  detail: string;
}

export interface mlFullnessComplaintPayload {
  example_prompt: string;
}

export interface mlFullnessComplaintResponse {
  status: string;
  color: string;
  analysis: string;
  suggested_text: string;
}

// Autocomplete Dict
export interface AutocompleteRequest {
  full_text: string;
  limit?: number;
}

export interface AutocompleteResponse {
  suggestions: string[];
}

//Main
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

export interface UserPublic {
  id: string;
  login: string;
  role: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

export interface ServiceUserData {
  id?: string;
  login: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ServiceUserRead {
  id: string;
  login: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ServiceUserIdRead {
  id: string;
  login: string;
  role: string;
}

export interface ServiceUserUpdate {
  login: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  is_active: boolean;
  password?: string | null;
}

export interface ServiceUserPatch {
  login?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  password?: string | null;
}

export interface ConsultationsRequest {
  external_system?: number | null;
  external_patient_id?: number | null;
  external_doctor_id?: number | null;
  external_visit_id?: number | null;
  consultation_datetime?: string | null;
  complaints?: string | null;
  disease_anamnesis?: string | null;
  disease_history?: string | null;
  patient_condition?: string | null;
  life_anamnesis?: string | null;
  bad_habits?: string | null;
  allergy_anamnesis?: string | null;
  vital_parameters?: string | null;
  objective_data?: string | null;
  clinical_assessment?: string | null;
  consultation_conclusion?: string | null;
  main_diagnosis?: string | null;
  comorbid_diagnoses?: string | null;
  recommendations?: string | null;
  prescriptions?: string | null;
  protocol_name?: string | null;
  status_protocol?: string | null;
  protocol_template_id?: string | null;
  [key: string]: unknown;
}

export interface ConsultationsResponse {
  id: string;
  service_user?: string | null;
  extra_fields?: Record<string, unknown> | null;
  external_system?: number | null;
  external_patient_id?: number | null;
  external_doctor_id?: number | null;
  external_visit_id?: number | null;
  consultation_datetime?: string | null;
  complaints?: string | null;
  disease_anamnesis?: string | null;
  disease_history?: string | null;
  patient_condition?: string | null;
  life_anamnesis?: string | null;
  bad_habits?: string | null;
  allergy_anamnesis?: string | null;
  vital_parameters?: string | null;
  objective_data?: string | null;
  clinical_assessment?: string | null;
  consultation_conclusion?: string | null;
  main_diagnosis?: string | null;
  comorbid_diagnoses?: string | null;
  recommendations?: string | null;
  prescriptions?: string | null;
  protocol_name?: string | null;
  status_protocol?: string | null;
  protocol_template_id?: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ListConsultationsResponse {
  id: string;
  updated_at: string | null;
  protocol_name?: string | null;
}

export interface ConsultationViewField {
  key: string;
  label: string;
  type: string;
  value?: unknown;
  is_extra?: boolean;
}

export interface ConsultationViewResponse {
  fields: ConsultationViewField[];
}

export interface ConsultationViewPatchItem {
  key: string;
  value?: unknown;
}

export interface ConsultationViewPatchRequest {
  fields?: ConsultationViewPatchItem[];
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
  page?: number;
  size?: number;
  searchValue?: string;
}

export interface ListsGroupsResponse {
  id: string;
  group_name: string;
}

export interface GroupRequest {
  group_name: string;
}

export interface GroupResponse {
  id: string;
  group_name: string;
  creator_id: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface TemplateGroupUpdate {
  group_name: string;
}

export interface ListsTemplatesResponse {
  id: string;
  protocol_name: string | null;
  group_id: string | null;
  protocol_structure_id: string | null;
  privacy: string | null;
}

export interface TemplatesRequest {
  protocol_name: string;
  privacy: ProtocolPrivacy;
  group_id?: string | null;
  protocol_structure_id?: string | null;
  fields?: FieldsType[];
}

export interface FieldsType {
  field_name: string;
  field_type: string;
  field_value?: string | null;
}

export interface FieldsTypeFull {
  id: string;
  field_name: string | null;
  field_type: string | null;
  field_value: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface TemplatesResponse {
  id: string;
  protocol_name: string | null;
  group_id: string | null;
  protocol_structure_id: string | null;
  creator_id: string | null;
  privacy: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  fields: FieldsTypeFull[];
}

export interface ProtocolTemplateUpdate {
  protocol_name?: string | null;
  privacy?: ProtocolPrivacy | null;
  group_id?: string | null;
  protocol_structure_id?: string | null;
  fields?: FieldsType[] | null;
}

export interface ProtocolStructures {
  id: string;
  creator_id: string;
  structure_code: string;
  structure_name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ProtocolStructuresPost {
  structure_code: string;
  structure_name: string;
  description?: string | null;
  version?: number;
  is_active?: boolean;
  fields?: StructureProtocolsFieldsSmall[];
}

export interface ProtocolStructuresPut {
  structure_code: string;
  structure_name: string;
  description?: string | null;
  version?: number;
  is_active?: boolean;
  fields?: StructureProtocolsFieldsSmall[];
}

export interface ProtocolStructuresPatch {
  structure_code?: string | null;
  structure_name?: string | null;
  description?: string | null;
  version?: number | null;
  is_active?: boolean | null;
  fields_add?: StructureProtocolsFieldsSmall[];
  fields_update?: StructureProtocolsFieldsPatch[];
  fields_delete?: string[];
}

export interface ProtocolStructuresFields {
  id: string;
  creator_id: string;
  structure_code: string;
  structure_name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  fields: StructureProtocolsFields[];
}

export interface StructureProtocolsFields {
  id: string;
  protocol_structure_id: string;
  field_name: string;
  field_label: string | null;
  description: string | null;
  field_type: string;
  default_value: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default_value_jsonb: any | null;
  dictionary: string | null;
  protocol_fields_main_id: string | null;
  is_required: boolean;
  sort_order: number;
}

export interface StructureProtocolsFieldsSmall {
  field_name: string;
  field_label?: string | null;
  description?: string | null;
  field_type: string;
  default_value?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default_value_jsonb?: any | null;
  dictionary?: string | null;
  protocol_fields_main_id?: string | null;
  is_required?: boolean;
  sort_order?: number;
}

export interface StructureProtocolsFieldsPatch {
  id: string;
  field_name?: string | null;
  field_label?: string | null;
  description?: string | null;
  field_type?: string | null;
  default_value?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default_value_jsonb?: any | null;
  dictionary?: string | null;
  protocol_fields_main_id?: string | null;
  is_required?: boolean | null;
  sort_order?: number | null;
}

export interface ProtocolFcieldsMain {
  id: string;
  field_name: string | null;
  field_label: string | null;
  description: string | null;
  endpoint_link: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface Protocols {
  id: string;
  service_user: string | null;
  protocol_structure_id: string | null;
  patient_id: number | null;
  doctor_id: string | null;
  protocol_name: string | null;
  status_protocol: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ProtocolsFields {
  id: string;
  service_user: string | null;
  protocol_structure_id: string | null;
  patient_id: number | null;
  doctor_id: string | null;
  protocol_name: string | null;
  status_protocol: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  field_values: Record<string, string | null>;
}

export interface ProtocolsPost {
  protocol_structure_id: string;
  patient_id?: number | null;
  doctor_id?: string | null;
  protocol_name?: string | null;
  status_protocol?: string | null;
  field_values?: Record<string, string | null>;
}

export interface ProtocolsPut {
  patient_id?: number | null;
  doctor_id?: string | null;
  protocol_name?: string | null;
  status_protocol?: string | null;
  field_values?: Record<string, string | null>;
}

export type ProtocolsPatch = ProtocolsPut;

export interface UserSettings {
  id: string;
  user_id: string;
  mkb_code: boolean;
  autocomplete: string;
  fullness_complaints: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserSettingsPost {
  mkb_code?: boolean | null;
  autocomplete?: string | null;
  fullness_complaints?: boolean | null;
}

export interface UserSettingsPut {
  mkb_code: boolean;
  autocomplete: string;
  fullness_complaints: boolean;
}

export type UserSettingsPatch = Partial<UserSettingsPost>;

export interface ClinrecCheck {
  protocol_text: string;
}

export interface ClinrecCheckResponse {
  severity_counts: Record<string, number>;
  findings: ClinicalFinding[];
  compliant_sections: string[];
  error: string | null;
}

export interface ClinicalFinding {
  severity: string;
  section: string;
  issue: string;
  recommendation: string;
  guideline_ref: string;
  guideline_quote: string;
}

export interface DictionaryNames {
  id: number;
  oid: string;
  name: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface RefSearchResponse {
  name: string;
  total: number;
  limit: number;
  offset: number;
  items: Record<string, unknown>[];
}
