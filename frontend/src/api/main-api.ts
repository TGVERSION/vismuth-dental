import { useAuthStore } from '@/store/authStore';
import type {
  ConsultationsRequest,
  ConsultationsResponse,
  ListConsultationsResponse,
  LoginRequest,
  LoginResponse,
  RegisterConfirmRequest,
  TokenResponse,
} from '.';

const API_BASE_URL = '/api/main';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
      localStorage.removeItem('access_token');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const mainApi = {
  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  },

  clearToken: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  },
  // Пользователи
  serviceUsers: {
    register: (data: LoginRequest) =>
      request<LoginResponse>(`/auth/register`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    confirm: (data: RegisterConfirmRequest) =>
      request<TokenResponse>(`/auth/register/confirm`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: LoginRequest) =>
      request<TokenResponse>(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Протоколы
  consultations: {
    getLists: (service_user: string) =>
      request<ListConsultationsResponse[]>(`/consultations/${service_user}`),
    create: (data: ConsultationsRequest) =>
      request<ConsultationsResponse>('/consultations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getConsultation: (consultation_id: string) =>
      request<ConsultationsResponse>(`/consultations/${consultation_id}`),
    update: (id: string, data: ConsultationsRequest) =>
      request<ConsultationsResponse>(`/consultations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/consultations/${id}`, { method: 'DELETE' }),
  },
};
