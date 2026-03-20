import { CompletePayload, CompleteResponse } from '.';

const API_BASE_URL = '/api/ml';

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

export const mlApi = {
  search: (complete_payload: CompletePayload) =>
    request<CompleteResponse>(`/autocomplete/complete`, {
      method: 'POST',
      body: JSON.stringify(complete_payload),
    }),
};
