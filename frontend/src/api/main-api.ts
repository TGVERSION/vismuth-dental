import type {
  ConsultationsRequest,
  ConsultationsResponse,
  ListConsultationsResponse,
} from '.';

const API_BASE_URL = '/api/main';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const mainApi = {
  // Пользователи
  serviceUsers: {},

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
