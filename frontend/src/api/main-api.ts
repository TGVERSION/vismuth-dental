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

const getAccessToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
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
