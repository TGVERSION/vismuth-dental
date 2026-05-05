import { ApiClient } from './base-client';
import type {
  ConsultationsRequest,
  ConsultationsResponse,
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
  ListsTemplatesResponse,
  TemplatesRequest,
  TemplatesResponse,
  mlFullnessComplaintPayload,
  mlFullnessComplaintResponse,
  ServiceUserData,
  ProtocolStructures,
  ProtocolStructuresFields,
  ProtocolStructuresPost,
  ProtocolStructuresPatch,
  ProtocolFcieldsMain,
  Protocols,
  ProtocolsFields,
  ProtocolsPost,
  ProtocolsPut,
} from './index';

export const apiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 10000,
  retries: 3,
  retryDelay: 100,
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
  },

  templateGroups: {
    getGroups: () => apiClient.get<ListsGroupsResponse[]>('/template-groups'),

    create: (data: GroupRequest) =>
      apiClient.post<GroupResponse>('/template-groups', data),

    update: (id: string, data: GroupRequest) =>
      apiClient.put<GroupResponse>(`/template-groups/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/template-groups/${id}`),
  },

  templates: {
    getTemplates: () =>
      apiClient.get<ListsTemplatesResponse[]>('/protocol-templates'),

    create: (data: TemplatesRequest) =>
      apiClient.post<TemplatesResponse>('/protocol-templates', data),

    getTemplate: (consultation_id: string) =>
      apiClient.get<TemplatesResponse>(
        `/protocol-templates/${consultation_id}`,
      ),

    update: (id: string, data: TemplatesRequest) =>
      apiClient.put<TemplatesResponse>(`/protocol-templates/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/protocol-templates/${id}`),
  },

  mkb10: {
    diagnisisList: (data: Mkb10Request) =>
      apiClient.get<Mkb10Response>('/mkb10/', {
        page: data.page,
        size: data.size,
        searchValue: data.searchValue,
      }),
  },

  ml_handlers: {
    mlMkbCode: (data: MlMkbCodePayload) =>
      apiClient.post<MlMkbCodeResponse>('/ml_mkb_code', data),

    mlAutocomplete: (data: CompletePayload) =>
      apiClient.post<CompleteResponse>('/ml_autocomplete', data),

    mlAutocompleteStatus: (data: MlStatusPayload) =>
      apiClient.post<MlStatusResponse>('/ml_autocomplete_stats', data),

    mlFullnessComplaint: (data: mlFullnessComplaintPayload) =>
      apiClient.post<mlFullnessComplaintResponse>(
        '/ml_fullness_complaints',
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

    updateProtocolStructuresById: (id: string, data: ProtocolStructuresPost) =>
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

    patchProtocolStructuresById: (id: string, data: ProtocolsPut) =>
      apiClient.patch<ProtocolsFields>(`/protocols/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/protocols/${id}`),
  },
};
