import { useAuthStore } from '@/store/authStore';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import axiosRetry from 'axios-retry';
import { logWarn } from '@/lib/logger';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Ошибка запроса с сохранённым HTTP-статусом. Без него вызывающий код не мог
 * отличить «записи ещё нет» (404) от настоящего сбоя и показывал пользователю
 * ошибку там, где её нет.
 */
export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Запрос отменён вызывающим кодом через AbortSignal. Не ошибка. */
export class RequestAbortedError extends Error {
  constructor() {
    super('Запрос отменён');
    this.name = 'RequestAbortedError';
  }
}

export const isAbortError = (error: unknown): boolean =>
  error instanceof RequestAbortedError;

export interface RequestOptions {
  signal?: AbortSignal;
}

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
        // Отменённый запрос повторять незачем: вызывающий код уже не ждёт ответа.
        if (axios.isCancel(error)) {
          return false;
        }
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
        logWarn(`Retry ${attempt}/${retries} for ${requestConfig.url}`, {
          error: error.message,
        });
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        // Единственный источник токена — authStore (он же персистит его
        // в localStorage через middleware persist).
        if (typeof window !== 'undefined') {
          const token = useAuthStore.getState().accessToken;
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
          // Только сбрасываем авторизацию. Переход на /login выполнит
          // ProtectedRoute средствами роутера — без жёсткой перезагрузки,
          // которая теряет несохранённые правки протокола.
          if (typeof window !== 'undefined') {
            useAuthStore.getState().clearAuth();
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
    options?: RequestOptions,
  ): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        headers: {
          ...headers,
        },
        params,
        signal: options?.signal,
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.data = body;
      }

      const response: AxiosResponse<T> = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new RequestAbortedError();
      }

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

        throw new ApiError(errorMessage, status);
      }

      throw error;
    }
  }

  get<T>(
    endpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: Record<string, any>,
    options?: RequestOptions,
  ) {
    return this.request<T>(endpoint, 'GET', undefined, {}, params, options);
  }

  post<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>,
    options?: RequestOptions,
  ) {
    return this.request<T>(endpoint, 'POST', body, headers, undefined, options);
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
}
