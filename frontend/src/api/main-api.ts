import {
  ApiClient,
  RequestOptions,
  registerSessionRefresh,
} from './base-client';
import { fileExtensionForMime } from '@/lib/voice-recording';
import type {
  ConsultationsRequest,
  ConsultationsResponse,
  ConsultationViewResponse,
  ConsultationViewPatchRequest,
  ListConsultationsResponse,
  LoginRequest,
  LoginResponse,
  RegisterConfirmRequest,
  TokenResponse,
  Mkb10Request,
  Mkb10Response,
  CompletePayload,
  CompleteResponse,
  MlMkbCodePayload,
  MlMkbCodeResponse,
  MlStatusResponse,
  MlStatusPayload,
  ListsGroupsResponse,
  GroupRequest,
  GroupResponse,
  TemplateGroupUpdate,
  ListsTemplatesResponse,
  TemplatesRequest,
  TemplatesResponse,
  ProtocolTemplateUpdate,
  mlFullnessComplaintPayload,
  mlFullnessComplaintResponse,
  ServiceUserData,
  ServiceUserRead,
  ServiceUserIdRead,
  ServiceUserUpdate,
  ServiceUserPatch,
  RoleRead,
  ProtocolStructures,
  ProtocolStructuresFields,
  ProtocolStructuresPost,
  ProtocolStructuresPut,
  ProtocolStructuresPatch,
  ProtocolFcieldsMain,
  Protocols,
  ProtocolsFields,
  ProtocolsPost,
  ProtocolsPut,
  ProtocolsPatch,
  UserSettings,
  UserSettingsPost,
  UserSettingsPut,
  UserSettingsPatch,
  ClinrecCheck,
  ClinrecCheckResponse,
  CheckDmsRequest,
  CheckDmsResponse,
  DictionaryNames,
  RefSearchResponse,
  AutocompleteRequest,
  AutocompleteResponse,
  SpeechSession,
  SpeechSessionCreate,
  SpeechSessionStatus,
  SpeechChunkAccepted,
  QuestionnaireStartRequest,
  QuestionnaireStartResponse,
  QuestionnaireStep,
  QuestionnaireStepAnswer,
  ClinicRead,
  ClinicCreate,
  ClinicPatch,
  ClinicMemberRead,
  ClinicMemberPatch,
  ClinicMemberInviteCreate,
  ClinicInvitationCreated,
  SpecializationRead,
  MyClinicRead,
  RegistryQuestionnaireCreate,
  RegistryQuestionnaireCreated,
  RegistryQuestionnaireDetail,
  RegistryQuestionnaireItem,
  RegistryQuestionnaireQuery,
  InvitationPreview,
  InvitationAcceptRequest,
  DoctorQuestionnaireListItem,
  DoctorQuestionnaireQuery,
  DoctorQuestionnaireDetail,
  CreateProtocolFromQuestionnaireRequest,
} from './index';

export const apiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 10000,
  retries: 3,
  retryDelay: 100,
});

// Backend-прокси ждёт ml-service до 180 с, поэтому клиентский таймаут берём
// чуть больше — 200 с. Прежние 1 200 000 мс (20 минут) означали, что при
// зависшем ml-service спиннер у врача не заканчивался никогда.
const ML_TIMEOUT_MS = 200000;

const mlLongRunningApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: ML_TIMEOUT_MS,
  retries: 0,
});

// Проверку для ДМС backend ждёт до 600 с (CLINREC_DMS_TIMEOUT): первый
// запрос по клинреку разбирает и индексирует PDF.
const DMS_TIMEOUT_MS = 610000;

const dmsApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: DMS_TIMEOUT_MS,
  retries: 0,
});

// Клиенты публичной анкеты пациента. Токена у пациента нет, а 401 от
// публичного эндпоинта не должен сбрасывать сессию врача, открывшего ссылку
// в своём браузере, — отсюда `auth: false`.

/** Только идемпотентные GET: повтор при обрыве связи безопасен. */
const publicApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 10000,
  retries: 3,
  auth: false,
});

/**
 * Старт анкеты. `retries: 0` обязателен: базовый `retryCondition` повторяет
 * сетевые ошибки при любом методе, и обрыв связи на POST молча создал бы
 * вторую анкету. ИИ при старте не вызывается — хватает обычного таймаута.
 */
const publicMutationApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 15000,
  retries: 0,
  auth: false,
});

// Ответ на шаг анкеты. На шагах, после которых backend запрашивает уточняющий
// вопрос ИИ, ответ ждёт ml-service до QUESTIONNAIRE_AI_TIMEOUT (20 с), а прокси
// Next обрывает запрос к backend через 30 с. Клиентский таймаут заведомо
// больше обоих, чтобы ошибку дал сервер или прокси, а не клиент. Повторов нет:
// повтор ответа, который сервер уже принял, получит 409 «Expected step» — но
// не на уточнениях ИИ, они идут одним шагом подряд. Поэтому ручной повтор
// хук анкеты начинает с перечитывания шага. Ожидание смягчается подписями
// в чате.
const QUESTIONNAIRE_CHAT_TIMEOUT_MS = 200000;

const publicChatApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: QUESTIONNAIRE_CHAT_TIMEOUT_MS,
  retries: 0,
  auth: false,
});

// Клиент записи приёма. Ретраи отключены для всех неидемпотентных запросов
// сессии, а не только для фрагментов: `retryCondition` в базовом клиенте
// повторяет сетевые ошибки при любом методе, поэтому обрыв связи на POST
// создал бы вторую сессию, повторно запустил обработку или продублировал
// кусок речи в расшифровке. Повторами управляет вызывающий код: он шлёт тот
// же `seq`, а сервер обязан обработать его идемпотентно.
const SPEECH_TIMEOUT_MS = 60000;

// Неидемпотентные запросы с авторизацией: создание клиники, приглашения,
// отключение сотрудника. Без повторов: `retryCondition` повторяет сетевые
// ошибки при любом методе, и обрыв связи создал бы вторую клинику или
// отправил второе письмо.
const mutationApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 15000,
  retries: 0,
});

const speechApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: SPEECH_TIMEOUT_MS,
  retries: 0,
});

// Обновление сессии по refresh-cookie.
//
// `auth: false` — клиент без интерцепторов: 401 от самого обновления значит
// «сессии нет» и не должен запускать обновление заново. Заголовок
// Authorization здесь тоже не нужен: backend читает только cookie, а браузер
// отправляет её сам — запрос идёт на тот же origin через прокси Next.
//
// `retries: 0` — refresh-токен одноразовый. Если сервер уже обновил его,
// а ответ потерялся, повтор предъявит отозванный токен, и backend отзовёт
// все сессии пользователя.
const sessionApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 15000,
  retries: 0,
  auth: false,
});

export const mainApi = {
  serviceUsers: {
    register: (data: LoginRequest) =>
      apiClient.post<LoginResponse>('/auth/register', data),

    confirm: (data: RegisterConfirmRequest) =>
      apiClient.post<TokenResponse>('/auth/register/confirm', data),

    login: (data: LoginRequest) =>
      apiClient.post<TokenResponse>('/auth/login', data),

    logout: () => apiClient.post<LoginResponse>('/auth/logout'),

    /**
     * Новый access-токен по refresh-cookie. Вызывается не из интерфейса,
     * а обработчиком 401 в `base-client.ts` — и только им: параллельный
     * вызов из другого места отозвал бы все сессии пользователя.
     */
    refresh: () => sessionApiClient.post<TokenResponse>('/auth/refresh'),

    serviceUser: () => apiClient.get<ServiceUserData>('/service_user'),

    listServiceUserIds: () =>
      apiClient.get<ServiceUserIdRead[]>('/service_user_ids'),

    getServiceUser: (user_id: string) =>
      apiClient.get<ServiceUserRead>(`/service_user/${user_id}`),

    updateServiceUser: (user_id: string, data: ServiceUserUpdate) =>
      apiClient.put<ServiceUserRead>(`/service_user/${user_id}`, data),

    patchServiceUser: (user_id: string, data: ServiceUserPatch) =>
      apiClient.patch<ServiceUserRead>(`/service_user/${user_id}`, data),

    deleteServiceUser: (user_id: string) =>
      apiClient.delete<void>(`/service_user/${user_id}`),
  },

  roles: {
    list: () => apiClient.get<RoleRead[]>('/roles'),
  },

  consultations: {
    getLists: () =>
      apiClient.get<ListConsultationsResponse[]>('/consultations'),

    create: (data: ConsultationsRequest) =>
      apiClient.post<ConsultationsResponse>('/consultations', data),

    getConsultation: (consultation_id: string) =>
      apiClient.get<ConsultationsResponse>(`/consultations/${consultation_id}`),

    update: (id: string, data: ConsultationsRequest) =>
      apiClient.put<ConsultationsResponse>(`/consultations/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/consultations/${id}`),

    getConsultationView: (consultation_id: string) =>
      apiClient.get<ConsultationViewResponse>(
        `/consultations/${consultation_id}/view`,
      ),

    patchConsultationView: (
      consultation_id: string,
      data: ConsultationViewPatchRequest,
    ) =>
      apiClient.patch<ConsultationViewResponse>(
        `/consultations/${consultation_id}/view`,
        data,
      ),
  },

  templateGroups: {
    getGroups: () => apiClient.get<ListsGroupsResponse[]>('/template-groups'),

    create: (data: GroupRequest) =>
      apiClient.post<GroupResponse>('/template-groups', data),

    update: (id: string, data: TemplateGroupUpdate) =>
      apiClient.put<GroupResponse>(`/template-groups/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/template-groups/${id}`),
  },

  templates: {
    getTemplates: () =>
      apiClient.get<ListsTemplatesResponse[]>('/protocol-templates'),

    create: (data: TemplatesRequest) =>
      apiClient.post<TemplatesResponse>('/protocol-templates', data),

    getTemplate: (template_id: string) =>
      apiClient.get<TemplatesResponse>(`/protocol-templates/${template_id}`),

    update: (id: string, data: ProtocolTemplateUpdate) =>
      apiClient.put<TemplatesResponse>(`/protocol-templates/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/protocol-templates/${id}`),
  },

  mkb10: {
    diagnisisList: (data: Mkb10Request, options?: RequestOptions) =>
      apiClient.get<Mkb10Response>(
        '/mkb10',
        {
          page: data.page,
          size: data.size,
          searchValue: data.searchValue,
        },
        options,
      ),
  },

  ml_handlers: {
    mlMkbCode: (data: MlMkbCodePayload, options?: RequestOptions) =>
      mlLongRunningApiClient.post<MlMkbCodeResponse>(
        '/ml_mkb_code',
        data,
        undefined,
        options,
      ),

    mlAutocomplete: (data: CompletePayload, options?: RequestOptions) =>
      mlLongRunningApiClient.post<CompleteResponse>(
        '/ml_autocomplete',
        data,
        undefined,
        options,
      ),

    mlAutocompleteStatus: (data: MlStatusPayload) =>
      mlLongRunningApiClient.post<MlStatusResponse>(
        '/ml_autocomplete_stats',
        data,
      ),

    mlFullnessComplaint: (data: mlFullnessComplaintPayload) =>
      mlLongRunningApiClient.post<mlFullnessComplaintResponse>(
        '/ml_fullness_complaints',
        data,
      ),

    ml_clinrec_check: (data: ClinrecCheck, options?: RequestOptions) =>
      mlLongRunningApiClient.post<ClinrecCheckResponse>(
        '/ml_clinrec_check',
        data,
        undefined,
        options,
      ),

    // Проверка назначений для ДМС по клиническим рекомендациям. Долгая:
    // клиент без повторов.
    check_dms: (data: CheckDmsRequest, options?: RequestOptions) =>
      dmsApiClient.post<CheckDmsResponse>(
        '/check_dms',
        data,
        undefined,
        options,
      ),
  },

  autocompleteDict: {
    complete: (data: AutocompleteRequest) =>
      apiClient.post<AutocompleteResponse>(
        '/autocomplete_dict/complete_dict',
        data,
      ),
  },

  protocol_structures: {
    getProtocolStructures: () =>
      apiClient.get<ProtocolStructures[]>('/protocol-structures'),

    postProtocolStructures: (data: ProtocolStructuresPost) =>
      apiClient.post<ProtocolStructuresFields>('/protocol-structures', data),

    getProtocolStructuresById: (id: string) =>
      apiClient.get<ProtocolStructuresFields>(`/protocol-structures/${id}`),

    updateProtocolStructuresById: (id: string, data: ProtocolStructuresPut) =>
      apiClient.put<ProtocolStructuresFields>(
        `/protocol-structures/${id}`,
        data,
      ),

    patchProtocolStructuresById: (id: string, data: ProtocolStructuresPatch) =>
      apiClient.patch<ProtocolStructuresFields>(
        `/protocol-structures/${id}`,
        data,
      ),

    delete: (id: string) =>
      apiClient.delete<void>(`/protocol-structures/${id}`),
  },

  protocol_fields_main: {
    getProtocolFcieldsMain: () =>
      apiClient.get<ProtocolFcieldsMain[]>('/protocol-fields-main'),

    getProtocolFcieldsMainById: (id: string) =>
      apiClient.get<ProtocolFcieldsMain>(`/protocol-fields-main/${id}`),
  },

  protocols: {
    getProtocols: () => apiClient.get<Protocols[]>('/protocols'),

    postProtocols: (data: ProtocolsPost) =>
      apiClient.post<ProtocolsFields>('/protocols', data),

    getProtocolsById: (id: string) =>
      apiClient.get<ProtocolsFields>(`/protocols/${id}`),

    updateProtocolsById: (id: string, data: ProtocolsPut) =>
      apiClient.put<ProtocolsFields>(`/protocols/${id}`, data),

    patchProtocolsById: (id: string, data: ProtocolsPatch) =>
      apiClient.patch<ProtocolsFields>(`/protocols/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/protocols/${id}`),
  },

  userSettings: {
    getUserSettings: (id: string) =>
      apiClient.get<UserSettings>(`/user-settings/${id}`),

    postUserSettings: (id: string, data: UserSettingsPost) =>
      apiClient.post<UserSettings>(`/user-settings/${id}`, data),

    updateUserSettings: (id: string, data: UserSettingsPut) =>
      apiClient.put<UserSettings>(`/user-settings/${id}`, data),

    patchUserSettings: (id: string, data: UserSettingsPatch) =>
      apiClient.patch<UserSettings>(`/user-settings/${id}`, data),
  },

  speech: {
    createSession: (data: SpeechSessionCreate) =>
      speechApiClient.post<SpeechSession>('/speech/sessions', data),

    /**
     * Отправка одного фрагмента записи.
     *
     * Заголовок `Content-Type` задаётся явно не для сервера, а для axios:
     * у клиента в умолчаниях стоит `application/json`, и с ним `FormData`
     * сериализуется в JSON — файл до сервера не доезжает. Как только заголовок
     * не JSON, axios отдаёт `FormData` как есть и браузер сам проставляет
     * `boundary`.
     */
    uploadChunk: (
      session_id: string,
      chunk: Blob,
      seq: number,
      mimeType: string,
      options?: RequestOptions,
    ) => {
      const form = new FormData();
      // Имя файла задаётся явно: без него браузер подставляет «blob», и на
      // сервере в логах и во временных файлах не видно, какой это фрагмент.
      form.append(
        'file',
        chunk,
        `chunk-${seq}.${fileExtensionForMime(mimeType)}`,
      );
      form.append('seq', String(seq));
      form.append('mime', mimeType);

      return speechApiClient.post<SpeechChunkAccepted>(
        `/speech/sessions/${session_id}/chunks`,
        form,
        { 'Content-Type': 'multipart/form-data' },
        options,
      );
    },

    complete: (session_id: string) =>
      speechApiClient.post<SpeechSessionStatus>(
        `/speech/sessions/${session_id}/complete`,
      ),

    getStatus: (session_id: string, options?: RequestOptions) =>
      apiClient.get<SpeechSessionStatus>(
        `/speech/sessions/${session_id}`,
        undefined,
        options,
      ),

    /** Сессия протокола: нужна, чтобы подхватить обработку после перезагрузки. */
    findByProtocol: (protocol_id: string, options?: RequestOptions) =>
      apiClient.get<SpeechSessionStatus[]>(
        '/speech/sessions',
        { protocol_id },
        options,
      ),

    cancel: (session_id: string) =>
      apiClient.delete<void>(`/speech/sessions/${session_id}`),
  },

  /**
   * Публичная анкета пациента (`/public/*`). Все методы идут без авторизации:
   * пациент открывает ссылку с телефона, аккаунта у него нет. Данные ссылки
   * загружает сервер Next (`server-api.ts`), список врачей приходит в ссылке
   * и в шаге `choose_doctor` — отдельных методов для них нет.
   */
  questionnaire: {
    /**
     * Создать анкету. `X-Device-Id` обязателен: по нему backend считает
     * лимит анкет с устройства.
     */
    start: (data: QuestionnaireStartRequest, deviceId: string) =>
      publicMutationApiClient.post<QuestionnaireStartResponse>(
        '/public/questionnaires',
        data,
        { 'X-Device-Id': deviceId },
      ),

    /** Текущий шаг — для продолжения после перезагрузки и после 409. */
    getStep: (id: string, token: string, options?: RequestOptions) =>
      publicApiClient.get<QuestionnaireStep>(
        `/public/questionnaires/${encodeURIComponent(id)}/step`,
        undefined,
        { ...options, headers: { 'X-Questionnaire-Token': token } },
      ),

    /** Ответ на текущий шаг; возвращает следующий шаг. */
    answer: (
      id: string,
      token: string,
      data: QuestionnaireStepAnswer,
      options?: RequestOptions,
    ) =>
      publicChatApiClient.post<QuestionnaireStep>(
        `/public/questionnaires/${encodeURIComponent(id)}/answer`,
        data,
        { 'X-Questionnaire-Token': token },
        options,
      ),
  },

  /** Клиники. Только для super_admin. */
  clinics: {
    list: () => apiClient.get<ClinicRead[]>('/super-admin/clinics'),

    get: (clinicId: string) =>
      apiClient.get<ClinicRead>(
        `/super-admin/clinics/${encodeURIComponent(clinicId)}`,
      ),

    create: (data: ClinicCreate) =>
      mutationApiClient.post<ClinicRead>('/super-admin/clinics', data),

    patch: (clinicId: string, data: ClinicPatch) =>
      apiClient.patch<ClinicRead>(
        `/super-admin/clinics/${encodeURIComponent(clinicId)}`,
        data,
      ),
  },

  /** Сотрудники клиники: super_admin или администратор клиники. */
  clinicMembers: {
    list: (clinicId: string) =>
      apiClient.get<ClinicMemberRead[]>(
        `/clinics/${encodeURIComponent(clinicId)}/members`,
      ),

    patch: (clinicId: string, memberId: string, data: ClinicMemberPatch) =>
      apiClient.patch<ClinicMemberRead>(
        `/clinics/${encodeURIComponent(clinicId)}/members/${encodeURIComponent(memberId)}`,
        data,
      ),

    deactivate: (clinicId: string, memberId: string) =>
      mutationApiClient.post<ClinicMemberRead>(
        `/clinics/${encodeURIComponent(clinicId)}/members/${encodeURIComponent(memberId)}/deactivate`,
      ),

    invite: (clinicId: string, data: ClinicMemberInviteCreate) =>
      mutationApiClient.post<ClinicInvitationCreated>(
        `/clinics/${encodeURIComponent(clinicId)}/invitations`,
        data,
      ),

    resendInvitation: (clinicId: string, invitationId: string) =>
      mutationApiClient.post<ClinicInvitationCreated>(
        `/clinics/${encodeURIComponent(clinicId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      ),
  },

  /**
   * Анкеты пациентов у регистратуры: персональные ссылки стоматологической
   * клиники. Доступ — администратор клиники или super_admin.
   */
  clinicQuestionnaires: {
    list: (
      clinicId: string,
      query: RegistryQuestionnaireQuery,
      options?: RequestOptions,
    ) =>
      apiClient.get<RegistryQuestionnaireItem[]>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires`,
        query,
        options,
      ),

    get: (clinicId: string, id: string, options?: RequestOptions) =>
      apiClient.get<RegistryQuestionnaireDetail>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires/${encodeURIComponent(id)}`,
        undefined,
        options,
      ),

    create: (clinicId: string, data: RegistryQuestionnaireCreate) =>
      mutationApiClient.post<RegistryQuestionnaireCreated>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires`,
        data,
      ),

    /** Новая ссылка взамен прежней: старая перестаёт работать. */
    regenerateLink: (clinicId: string, id: string) =>
      mutationApiClient.post<{ url: string }>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires/${encodeURIComponent(id)}/link`,
      ),

    markPrinted: (clinicId: string, id: string) =>
      mutationApiClient.post<RegistryQuestionnaireItem>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires/${encodeURIComponent(id)}/printed`,
      ),

    markSigned: (clinicId: string, id: string) =>
      mutationApiClient.post<RegistryQuestionnaireItem>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires/${encodeURIComponent(id)}/signed`,
      ),

    remove: (clinicId: string, id: string) =>
      mutationApiClient.delete<void>(
        `/clinics/${encodeURIComponent(clinicId)}/questionnaires/${encodeURIComponent(id)}`,
      ),
  },

  specializations: {
    list: () => apiClient.get<SpecializationRead[]>('/specializations'),
  },

  /**
   * Клиника текущего пользователя и публичные ссылки анкеты пациента.
   * Пользователь без активного членства в клинике получает 404.
   */
  myClinic: {
    get: (options?: RequestOptions) =>
      apiClient.get<MyClinicRead>('/me/clinic', undefined, options),
  },

  /**
   * Анкеты пациентов у врача. Авторизованный клиент: эндпоинты требуют
   * активного membership врача в клинике, и 403 для не-врача — штатный ответ.
   */
  doctorQuestionnaires: {
    list: (query: DoctorQuestionnaireQuery, options?: RequestOptions) =>
      apiClient.get<DoctorQuestionnaireListItem[]>(
        '/questionnaires',
        query,
        options,
      ),

    get: (id: string, options?: RequestOptions) =>
      apiClient.get<DoctorQuestionnaireDetail>(
        `/questionnaires/${encodeURIComponent(id)}`,
        undefined,
        options,
      ),

    /**
     * Создать протокол из анкеты. Сервер создаёт ровно один протокол и
     * отвечает 409 на повтор, поэтому клиент без повторов: повтор после
     * обрыва связи получил бы 409 вместо созданного протокола.
     */
    createProtocol: (
      id: string,
      data: CreateProtocolFromQuestionnaireRequest,
    ) =>
      mutationApiClient.post<ProtocolsFields>(
        `/questionnaires/${encodeURIComponent(id)}/protocol`,
        data,
      ),
  },

  /**
   * Принятие приглашения сотрудником. Без авторизации: у приглашённого ещё
   * нет аккаунта, а чужой 401 не должен сбрасывать сессию в этом браузере.
   */
  invitations: {
    preview: (token: string) =>
      publicApiClient.get<InvitationPreview>(
        `/auth/invitations/${encodeURIComponent(token)}`,
      ),

    accept: (data: InvitationAcceptRequest) =>
      publicMutationApiClient.post<TokenResponse>(
        '/auth/invitations/accept',
        data,
      ),
  },

  dictionary: {
    getDictionary: () => apiClient.get<DictionaryNames[]>(`/dictionary`),
    getDictionaryRef: (
      name: string,
      params?: { search?: string; limit?: number; offset?: number },
    ) => apiClient.get<RefSearchResponse>(`/ref/${name}`, params),
  },
};

// Клиенты с авторизацией продлевают сессию этим запросом, когда получают 401
// (см. «Продление сессии» в `base-client.ts`).
registerSessionRefresh(
  async () => (await mainApi.serviceUsers.refresh()).access_token,
);
