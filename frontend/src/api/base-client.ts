import { useAuthStore } from '@/store/authStore';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import axiosRetry from 'axios-retry';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class ApiClient {
  private client: AxiosInstance;
  private retries: number;

  constructor({
    baseUrl,
    timeout = 10000,
    retries = 3,
    retryDelay = 100,
  }: ApiClientConfig) {
    this.retries = retries;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    axiosRetry(this.client, {
      retries,
      retryDelay: (attempt) => retryDelay * Math.pow(2, attempt - 1),
      retryCondition: (error) => {
        if (
          error.response?.status &&
          error.response.status >= 400 &&
          error.response.status < 500
        ) {
          return false;
        }
        return axiosRetry.isNetworkOrIdempotentRequestError(error);
      },
      onRetry: (attempt, error, requestConfig) => {
        console.warn(`Retry ${attempt}/${retries} for ${requestConfig.url}`, {
          error: error.message,
        });
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        // Пример: получение токена из Zustand store
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('access_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Очищаем авторизацию и редиректим на логин
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  async request<T>(
    endpoint: string,
    method: RequestMethod = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        headers: {
          ...headers,
        },
        params,
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.data = body;
      }

      const response: AxiosResponse<T> = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data as {
          message?: string;
          detail?: string;
        };

        const errorMessage =
          data?.message ||
          data?.detail ||
          error.message ||
          `HTTP ${status || 'Error'}`;

        throw new Error(errorMessage);
      }

      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T>(endpoint: string, params?: Record<string, any>) {
    return this.request<T>(endpoint, 'GET', undefined, {}, params);
  }

  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, 'POST', body, headers);
  }

  put<T>(endpoint: string, body: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, 'PUT', body, headers);
  }

  delete<T>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, 'DELETE', undefined, headers);
  }

  patch<T>(endpoint: string, body: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, 'PATCH', body, headers);
  }
  getInstance(): AxiosInstance {
    return this.client;
  }
}
