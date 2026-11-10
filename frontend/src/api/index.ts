export { mainApi } from './main-api';
export { mlApi } from './ml-api';

export interface ApiError {
  detail: string;
}

// Enums
export type AutocompleteType = 'ml_autocomplete' | 'dict_autocomplete';
export type MkbEventType =
  | 'form_click'
  | 'autocomplete_shown'
  | 'suggestion_selected';
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

export type RoleName = 'super_admin' | 'admin' | 'doctor' | 'patient';

export interface RoleRead {
  name: RoleName;
  name_ru: string;
}

export interface UserPublic {
  id: string;
  login: string;
  role: RoleName;
  role_name_ru: string;
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
  role: RoleName;
  role_name_ru: string;
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
  role: RoleName;
  role_name_ru: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ServiceUserIdRead {
  id: string;
  login: string;
  role: RoleName;
  role_name_ru: string;
}

export interface ServiceUserUpdate {
  login: string;
  first_name?: string | null;
  last_name?: string | null;
  role: RoleName;
  is_active: boolean;
  password?: string | null;
}

export interface ServiceUserPatch {
  login?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: RoleName | null;
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

/** Проверка назначений для ДМС: docs/contracts/check-dms.md. */
export interface CheckDmsRequest {
  /** Код МКБ или «код + название»: по нему backend подбирает клинрек. */
  mkb: string;
  /** Назначения свободным текстом, до 4000 знаков. */
  appointments: string;
}

/** Часть исходного текста назначений; склейка частей равна тексту. */
export interface CheckDmsSegment {
  text: string;
  /** Назначение не подтверждается клиническими рекомендациями. */
  unnecessary: boolean;
}

export interface CheckDmsFragment {
  /** Номер и заголовок раздела клинрека. */
  section: string;
  text: string;
}

export interface CheckDmsResponse {
  appointments: CheckDmsSegment[];
  /** Фрагменты клинрека, на которые опирался вердикт. */
  fragments: CheckDmsFragment[];
  guideline_code?: string | null;
  guideline_title?: string | null;
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

// Запись приёма и распознавание речи.
//
// Контракт согласуется со смежной командой: на момент написания эндпоинтов
// `/speech/*` в backend нет. Описание — в docs/plans/voice-input-2026-08-29,
// раздел «Внешние зависимости».

export interface SpeechSessionCreate {
  protocol_id: string;
}

export interface SpeechSession {
  session_id: string;
}

/** Ответ на загрузку фрагмента. Тело не используется, важен сам код 202. */
export interface SpeechChunkAccepted {
  session_id: string;
  seq: number;
}

export type SpeechSessionStatusValue =
  | 'recording'
  | 'processing'
  | 'done'
  | 'error';

export interface SpeechSessionStatus {
  session_id: string;
  protocol_id: string;
  status: SpeechSessionStatusValue;
  /**
   * Начало записи, ISO 8601. Нужно, чтобы различать записи одного протокола:
   * приём могли записать несколько раз.
   */
  created_at: string | null;
  /** Доля выполненной обработки от 0 до 1, если сервер её сообщает. */
  progress: number | null;
  /** Полная расшифровка приёма. */
  transcript: string | null;
  /**
   * Распределение текста по полям: ключ — UUID поля структуры протокола,
   * тот же, которым фронтенд оперирует в `field_values`.
   */
  field_values: Record<string, string> | null;
  error: string | null;
}

// Анкета пациента до приёма — публичные эндпоинты backend `/public/*`:
// routers/public_questionnaire.py, services/questionnaire_flow.py, схемы
// schemas/questionnaire.py, описание — docs/contracts/questionnaire-public.md
// (неполное: форматы `options`, `choices` и коды ошибок сверены по коду).
//
// Сценарий ведёт сервер: он хранит текущий шаг, отдаёт его описание
// (`QuestionnaireStep`) и в ответ на ответ пациента — следующий шаг.
// Строковые `step_key`, `step_type`, `block_code` и разнородные `options`
// сужаются в src/lib/questionnaire.ts, а не принимаются на веру.

export type PublicLinkType = 'clinic' | 'doctor';

export interface PublicSpecialization {
  id: number;
  code: string | null;
  name: string;
}

export interface PublicLinkDoctor {
  membership_id: string;
  public_slug: string | null;
  /** Недоверенный URL: перед отрисовкой проходит `sanitizeImageUrl`. */
  photo_url: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  specializations: PublicSpecialization[];
}

export interface PublicLink {
  link_type: PublicLinkType;
  clinic_id: string;
  clinic_name: string;
  phone: string | null;
  /** Недоверенный URL: перед отрисовкой проходит `sanitizeImageUrl`. */
  logo_url: string | null;
  /** Недоверенное значение: валидируется до попадания в CSS. */
  brand_color: string | null;
  button_color?: string | null;
  clinic_public_slug: string;
  /** Заполнен только для ссылки активного врача. */
  doctor: PublicLinkDoctor | null;
  /** Активные врачи клиники — в том числе при `doctor_inactive`. */
  doctors: PublicLinkDoctor[];
  blocked: boolean;
  /** subscription_expired | clinic_daily_limit | doctor_inactive; сужается в lib. */
  block_code: string | null;
  block_message: string | null;
  /** ВЗ-7: backend пока не присылает. undefined — согласие не показывается. */
  consent_required?: boolean;
}

export interface QuestionnaireChoice {
  value: string;
  label: string;
  /** Подпись под строкой: только у списка здоровья стоматологической анкеты. */
  hint?: string;
  section?: string;
}

/** Дескриптор шага. step_key и step_type — строки backend, сужаются в lib. */
export interface QuestionnaireStep {
  step_key: string;
  step_type: string;
  title: string | null;
  text: string | null;
  required: boolean;
  allow_skip: boolean;
  allow_none: boolean;
  choices: QuestionnaireChoice[];
  /**
   * Врачи (`choose_doctor`) или специализации (`choose_specialization`).
   * Форма зависит от шага, поэтому `unknown` с разбором в lib.
   */
  options: unknown[];
  /**
   * Стоматологическая анкета, `step_type=chip_groups`: группы кнопок.
   * Форма сужается в `lib/dental-questionnaire.ts`. У общей анкеты пусто.
   */
  groups?: unknown[];
  /** Дескриптор отдельного первичного гастросценария; проверяется перед рендером. */
  gastro?: unknown;
  /** Стоматология: серверная ревизия, сохранённые ответы и разрешённые исправления. */
  dental?: {
    revision: number;
    question_key?: string;
    question?: unknown;
    allow_empty?: boolean;
    conversation_progress?: { current: number; total: number; label: string };
    answers: {
      flow_version?: number;
      health_answered?: string[];
      health: string[] | null;
      health_unknown: string[];
      health_comments?: Record<string, string>;
      groups: Record<string, { selected: string[]; text: string }>;
      ai?: {
        question: string;
        answer: string;
        choices?: string[];
        skipped?: boolean;
      }[];
    };
    editable_steps?: string[];
    progress?: { current: number; total: number; label: string };
    navigation?: { step_key: string; label: string }[];
    /** Принятые сервером ответы для чтения в переписке, без переходов назад. */
    history?: {
      id: string;
      step_key: string;
      question: string;
      answer: string;
    }[];
    page?: { kind: 'health' | 'details'; current: number; total: number };
    review?: DoctorQuestionnaireStructured;
  };
  /** YYYY-MM-DD по часам сервера. */
  date_min: string | null;
  date_max: string | null;
  /** Данные приёма, уже заданные сотрудником в ссылке; пациент их не меняет. */
  appointment_date?: string | null;
  appointment_time?: string | null;
  /** Четыре цифры на шаге `code`. */
  code: string | null;
  completed: boolean;
  /** Сервер обрезал ответ до своего предела. */
  truncated: boolean;
  /** ИИ не ответил: уточняющие не задаются, врач увидит пометку. */
  ai_unavailable: boolean;
}

export interface QuestionnaireStartRequest {
  slug: string;
  doctor_membership_id?: string | null;
}

export interface QuestionnaireStartResponse {
  id: string;
  /** Токен анкеты для заголовка `X-Questionnaire-Token`. */
  token: string;
  step: QuestionnaireStep;
}

/**
 * Ответ на шаг. Заполняются только поля текущего шага.
 *
 * `skip` у backend есть, но в тип не внесён: пропуск вопроса исключён ТЗ
 * 22.09.2026 (решение 4).
 */
export interface QuestionnaireStepAnswer {
  step_key: string;
  /** Одна отправка и её повторы используют один UUID. */
  answer_id?: string;
  /** Защита гастросценария от устаревшей вкладки и повторной отправки. */
  revision?: number;
  value?: string | null;
  choice?: string | null;
  none?: boolean;
  doctor_membership_id?: string | null;
  specialization_id?: number | null;
  first_name?: string | null;
  middle_name?: string | null;
  /** YYYY-MM-DD. */
  appointment_date?: string | null;
  /** HH:MM. */
  appointment_time?: string | null;
  /** Стоматологическая анкета: выбранные значения по ключу группы. */
  selections?: Record<string, string[]>;
  /** Стоматологическая анкета: свой текст по ключу группы. */
  texts?: Record<string, string>;
  /** Пропустить вопрос — только у уточнения нейросети в стоматологической анкете. */
  skip?: boolean;
}

/**
 * Персональная ссылка регистратуры (`GET /public/invites/{token}`):
 * приветствие и текущий шаг. Дальше — те же `/public/questionnaires/{id}/…`
 * с токеном ссылки. Описание — docs/contracts/questionnaire-public.md.
 */
export interface PublicInvite {
  questionnaire_id: string;
  clinic_name: string;
  phone: string | null;
  logo_url: string | null;
  brand_color: string | null;
  button_color?: string | null;
  patient_first_name: string | null;
  patient_middle_name: string | null;
  blocked: boolean;
  /** invite_expired | subscription_expired. */
  block_code: string | null;
  block_message: string | null;
  step: QuestionnaireStep | null;
}

// ---------------------------------------------------------------------------
// Анкеты у врача — backend routers/questionnaires.py, схемы
// schemas/questionnaire.py, описание — docs/contracts/questionnaires.md.
//
// Почти все поля в схеме backend необязательные, поэтому здесь `| null`:
// фронтенд обязан переживать пустое значение в любом из них.

export type QuestionnaireVisitType = 'primary' | 'repeat';

export type QuestionnaireProcessingStatus = 'pending' | 'done' | 'failed';

export interface DoctorQuestionnaireListItem {
  id: string;
  /** YYYY-MM-DD. */
  appointment_date: string | null;
  /** HH:MM — слот из настроек backend. */
  appointment_time: string | null;
  /** Есть только у анкеты по персональной ссылке регистратуры. */
  patient_last_name?: string | null;
  patient_first_name: string | null;
  patient_middle_name: string | null;
  /** В схеме backend — `Optional[str]`; сужается в `lib/doctor-questionnaires`. */
  visit_type: string | null;
  specialization_name: string | null;
  code: string | null;
  protocol_id: string | null;
  /**
   * В ответе списка backend этого поля пока нет (внешняя зависимость ВЗ-6
   * задачи PL-253). `undefined` — сервер статус не сообщил.
   */
  processing_status?: QuestionnaireProcessingStatus | null;
}

export interface DoctorQuestionnaireQuery {
  /** YYYY-MM-DD. Без даты backend берёт «сегодня» в поясе сервера. */
  date?: string;
  visit_type?: QuestionnaireVisitType;
  /** Ровно четыре символа, иначе 422. */
  code?: string;
  /** Подстрока имени или отчества — по каждому полю отдельно. */
  name?: string;
}

export interface DoctorQuestionnaireStructured {
  complaints?: string | null;
  medications?: string | null;
  allergy_anamnesis?: string | null;
  life_anamnesis?: string | null;
  /** Гастроанкета: исходная история и только подтверждённые элементы хронологии. */
  history?: unknown;
  safety?: string | null;
  /** Собственные вопросы пациента, без пересказа и автоматического переноса в протокол. */
  patient_questions?: string[];
  /** Стоматологическая анкета: «Самое важное» — красные строки. */
  important?: string[];
  /**
   * То же без предупреждений врачу — только факты из ответов пациента.
   * Идёт на лист, который пациент подписывает.
   */
  important_facts?: string[];
  /** Стоматологическая анкета: все строки здоровья, «да» и «нет». */
  health?: DentalHealthRow[];
  /** Дата рождения, последний визит, «дополнительно» — одной строкой врачу. */
  about?: string | null;
  /** Вопросы нейросети и ответы пациента дословно; пустой ответ — пропустил. */
  clarifications?: DentalClarification[];
  /** Бланк «Анкета о здоровье» с ответами — лист для подписи пациента. */
  paper_form?: DentalPaperForm;
}

export interface DentalClarification {
  question: string;
  answer: string;
}

/**
 * Бланк «Анкета о здоровье» (МК Дент), заполненный ответами пациента.
 * Формулировки — бланковые, с сервера: экран их только расставляет.
 */
export interface DentalPaperForm {
  /** Пусто — пациент не ответил, впишет от руки. */
  birth_date: string;
  visit_year: string;
  visit_clinic: string;
  /** «Дополнительно хочу сообщить о состоянии здоровья». */
  more: string;
  /** «Какую стоматологическую проблему вы хотели бы решить»: а) … ж). */
  problems: { letter: string; text: string; selected: boolean }[];
  /** 43 строки бланка по порядку. */
  rows: DentalPaperRow[];
}

export interface DentalPaperRow {
  number: number;
  text: string;
  /** Да / Нет строки; null — у строки только подпункты. */
  answer: boolean | null;
  /** «Если да, то когда …»; null — вписывать нечего. */
  note_label: string | null;
  note: string;
  /** «Нужное подчеркнуть». */
  underline: { text: string; selected: boolean }[];
  subs: { text: string; answer: boolean | null; note: string }[];
}

export interface DentalHealthRow {
  key: string;
  label: string;
  has: boolean | null;
  /** Уточнение пациента; пусто при «нет». */
  detail: string;
}

export interface DoctorQuestionnaireAnswer {
  seq: number;
  step_key: string;
  kind: string;
  question_text: string | null;
  answer_text: string | null;
  choice: string | null;
}

export interface DoctorQuestionnaireDetail extends Omit<
  DoctorQuestionnaireListItem,
  'processing_status'
> {
  /** `dental` — стоматологическая анкета: карточка собрана правилами. */
  kind?: 'general' | 'dental' | 'gastro';
  ai_unavailable: boolean;
  processing_status: QuestionnaireProcessingStatus | null;
  /** Результат обработки ИИ; `null`, пока обработка не завершилась. */
  structured: DoctorQuestionnaireStructured | null;
  /**
   * «Что доспросить». Формат элемента в контракте не описан (ВЗ-1),
   * поэтому `unknown` — разбирается в `lib/doctor-questionnaires`.
   */
  gaps: unknown[] | null;
  answers: DoctorQuestionnaireAnswer[];
}

export interface CreateProtocolFromQuestionnaireRequest {
  protocol_structure_id: string;
  protocol_name?: string | null;
}

// ---------------------------------------------------------------------------
// Клиники (super_admin), сотрудники клиники и приглашения — backend
// schemas/clinic.py, schemas/clinic_admin.py, schemas/invitation.py.

export type ClinicAccessType = 'trial' | 'paid';

/** `dental` — стоматологическая анкета по персональным ссылкам регистратуры. */
export type ClinicQuestionnaireKind = 'general' | 'dental' | 'mixed';

/** Статус доступа, который backend вычисляет по типу и дате. */
export type ClinicAccessStatus = 'trial' | 'paid' | 'expired';

export interface ClinicRead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  brand_color: string | null;
  button_color?: string | null;
  doctors_limit: number;
  /** `YYYY-MM-DD`. */
  access_until: string;
  access_type: ClinicAccessType;
  questionnaire_kind: ClinicQuestionnaireKind;
  public_slug: string;
  access_status_code: ClinicAccessStatus;
  access_status_label: string;
  doctors_count: number;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ClinicCreate {
  name: string;
  phone?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  button_color?: string | null;
  doctors_limit?: number;
  access_until: string;
  access_type: ClinicAccessType;
  questionnaire_kind?: ClinicQuestionnaireKind;
}

export type ClinicPatch = Partial<ClinicCreate>;

export interface SpecializationRead {
  id: number;
  code: string | null;
  name: string;
}

/**
 * Клиника текущего пользователя, его роли в ней и публичные ссылки анкеты
 * пациента (`GET /me/clinic`, routers/clinic_admin.py). Нет активного
 * членства в клинике — 404.
 */
export interface MyClinicRead {
  is_operator?: boolean;
  clinic_id: string;
  clinic_name: string;
  clinic_public_slug: string;
  /** `{FRONTEND_PUBLIC_URL}/q/{slug}` — адрес собирает backend. */
  clinic_public_url: string;
  /** `dental` — анкета по персональным ссылкам регистратуры. */
  questionnaire_kind: ClinicQuestionnaireKind;
  membership_id: string;
  is_clinic_admin: boolean;
  is_doctor: boolean;
  /** `null`, если пользователь не врач. */
  doctor_public_slug: string | null;
  doctor_public_url: string | null;
  specializations: SpecializationRead[];
}

// ---------------------------------------------------------------------------
// Анкеты пациентов у регистратуры (админ стоматологической клиники) —
// backend routers/clinic_questionnaires.py, описание —
// docs/contracts/clinic-questionnaires.md.

export type RegistryStatus =
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'printed'
  | 'signed';

export interface RegistryQuestionnaireItem {
  id: string;
  status: RegistryStatus;
  patient_last_name: string | null;
  patient_first_name: string | null;
  patient_middle_name: string | null;
  created_at: string;
  completed_at: string | null;
  printed_at: string | null;
  signed_at: string | null;
  invite_expires_at: string | null;
}

export interface RegistryQuestionnaireCreated extends RegistryQuestionnaireItem {
  /** Персональная ссылка; показывается один раз. */
  url: string;
}

export interface RegistryQuestionnaireDetail extends RegistryQuestionnaireItem {
  structured: DoctorQuestionnaireStructured | null;
  /** `{ section, question }`, как у врача — разбирается в `lib/doctor-questionnaires`. */
  gaps: unknown[] | null;
}

export interface RegistryQuestionnaireCreate {
  last_name: string;
  first_name: string;
  middle_name: string | null;
  birth_date?: string | null;
}

/** Новые анкеты сверху; фильтры — статус и ФИО. */
export interface RegistryQuestionnaireQuery {
  status?: RegistryStatus;
  name?: string;
}

export type ClinicMemberStatus = 'invited' | 'active' | 'deactivated';

/** Сотрудник клиники или ещё не принятое приглашение. */
export interface ClinicMemberRead {
  is_operator?: boolean;
  id: string;
  kind: 'membership' | 'invitation';
  status: ClinicMemberStatus;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  photo_url: string | null;
  is_clinic_admin: boolean;
  is_doctor: boolean;
  specializations: SpecializationRead[];
  public_slug: string | null;
  public_url: string | null;
  expires_at: string | null;
  user_id: string | null;
}

export interface ClinicMemberPatch {
  is_operator?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  photo_url?: string | null;
  is_clinic_admin?: boolean;
  is_doctor?: boolean;
  specialization_ids?: number[];
}

export interface ClinicMemberInviteCreate {
  is_operator?: boolean;
  email: string;
  is_clinic_admin: boolean;
  is_doctor: boolean;
  specialization_ids: number[];
}

/**
 * Созданное или повторно отправленное приглашение. `invite_url` содержит
 * одноразовый токен: его не логируют и не сохраняют.
 */
export interface ClinicInvitationCreated {
  is_operator?: boolean;
  id: string;
  clinic_id: string;
  email: string;
  is_clinic_admin: boolean;
  is_doctor: boolean;
  expires_at: string;
  invite_url: string;
  email_sent: boolean;
  email_error: string | null;
}

/** Превью приглашения по токену из ссылки (без авторизации). */
export interface InvitationPreview {
  is_operator?: boolean;
  email: string;
  clinic_name: string;
  clinic_id: string;
  first_name: string | null;
  last_name: string | null;
  is_clinic_admin: boolean;
  is_doctor: boolean;
  expires_at: string;
}

export interface InvitationAcceptRequest {
  token: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
}
