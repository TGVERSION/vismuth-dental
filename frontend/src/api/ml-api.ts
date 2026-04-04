import { ApiClient } from './base-client';
import type { CompletePayload, CompleteResponse } from './';

export const mlApiClient = new ApiClient({
  baseUrl: '/api/ml',
  timeout: 15000,
  retries: 2,
});

export const mlApi = {
  search: (complete_payload: CompletePayload) =>
    mlApiClient.post<CompleteResponse>(
      '/autocomplete/complete',
      complete_payload,
    ),
};
