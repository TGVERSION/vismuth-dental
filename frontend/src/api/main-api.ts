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
} from './index';

export const apiClient = new ApiClient({
  baseUrl: '/api/main',
  timeout: 10000,
  retries: 3,
  retryDelay: 100,
});

export const mainApi = {
  mkb10: {
    diagnisisList: (data: Mkb10Request) =>
      apiClient.get<Mkb10Response>('/mkb10/', {
        page: data.page,
        size: data.size,
        searchValue: data.searchValue,
      }),
  },

  // Пользователи
  serviceUsers: {
    register: (data: LoginRequest) =>
      apiClient.post<LoginResponse>('/auth/register', data),

    confirm: (data: RegisterConfirmRequest) =>
      apiClient.post<TokenResponse>('/auth/register/confirm', data),

    login: (data: LoginRequest) =>
      apiClient.post<TokenResponse>('/auth/login', data),
    logout: () => apiClient.post<LoginResponse>('/auth/logout'),
  },

  // Протоколы
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
};
