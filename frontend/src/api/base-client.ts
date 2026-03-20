export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor({ baseUrl, timeout = 10000, retries = 3 }: ApiClientConfig) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.retries = retries;
  }

  async request<T>(
    endpoint: string,
    method: RequestMethod = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        // Не retry-им ошибки 4xx
        if (lastError.message.includes('4')) {
          break;
        }

        // Ждём перед повторной попыткой (exponential backoff)
        if (attempt < this.retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.pow(2, attempt)),
          );
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, 'GET');
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, 'POST', body);
  }

  put<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, 'PUT', body);
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, 'DELETE');
  }
}
