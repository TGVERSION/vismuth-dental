import { ApiClient } from './base-client';
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
  DictionaryNames,
  RefSearchResponse,
  AutocompleteRequest,
  AutocompleteResponse,
} from './index';

export const apiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 10000,
  retries: 3,
  retryDelay: 100,
});

const mlLongRunningApiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 1200000,
  retries: 0,
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
    diagnisisList: (data: Mkb10Request) =>
      apiClient.get<Mkb10Response>('/mkb10', {
        page: data.page,
        size: data.size,
        searchValue: data.searchValue,
      }),
  },

  ml_handlers: {
    mlMkbCode: (data: MlMkbCodePayload) =>
      mlLongRunningApiClient.post<MlMkbCodeResponse>('/ml_mkb_code', data),

    mlAutocomplete: (data: CompletePayload) =>
      mlLongRunningApiClient.post<CompleteResponse>('/ml_autocomplete', data),

    mlAutocompleteStatus: (data: MlStatusPayload) =>
      mlLongRunningApiClient.post<MlStatusResponse>('/ml_autocomplete_stats', data),

    mlFullnessComplaint: (data: mlFullnessComplaintPayload) =>
      mlLongRunningApiClient.post<mlFullnessComplaintResponse>(
        '/ml_fullness_complaints',
        data,
      ),

    ml_clinrec_check: (data: ClinrecCheck) =>
      mlLongRunningApiClient.post<ClinrecCheckResponse>(
        '/ml_clinrec_check',
        data,
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

  dictionary: {
    getDictionary: () => apiClient.get<DictionaryNames[]>(`/dictionary`),
    getDictionaryRef: (
      name: string,
      params?: { search?: string; limit?: number; offset?: number },
    ) => apiClient.get<RefSearchResponse>(`/ref/${name}`, params),
  },
};
