import { useAuthStore } from '@/store/authStore';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import axiosRetry from 'axios-retry';
import { logWarn } from '@/lib/logger';
import { parseErrorBody } from '@/lib/api-error';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Ошибка запроса с сохранённым HTTP-статусом. Без него вызывающий код не мог
 * отличить «записи ещё нет» (404) от настоящего сбоя и показывал пользователю
 * ошибку там, где её нет.
 *
 * `code` — машинный код отказа из `detail: { code, message }`: лимиты анкеты
 * пациента различаются только им, статус у них общий.
 */
export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
  /**
   * Заголовки запроса. Нужны там, где у метода нет аргумента заголовков,
   * — в `get` (например, токен анкеты пациента). При совпадении имён важнее
   * аргумента `headers`.
   */
  headers?: Record<string, string>;
}

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  /**
   * Участвует ли клиент в авторизации. По умолчанию `true` — поведение всех
   * существующих клиентов не меняется.
   *
   * `false` нужен публичным эндпоинтам (анкета пациента): токен врача туда
   * отправлять незачем, а сброс авторизации по 401 там вреден — врач,
   * открывший ссылку анкеты в своём браузере, оказался бы разлогинен
   * в Ассистенте.
   */
  auth?: boolean;
}

export class ApiClient {
  private client: AxiosInstance;
  private retries: number;

  constructor({
    baseUrl,
    timeout = 10000,
    retries = 3,
    retryDelay = 100,
    auth = true,
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
        // URL — только в подробностях (они выводятся лишь в dev): в пути
        // бывают секреты — токен приглашения, код анкеты пациента.
        logWarn(
          `Retry ${attempt}/${retries} ${requestConfig.method?.toUpperCase() ?? ''}`,
          { url: requestConfig.url, error: error.message },
        );
      },
    });

    // Публичный клиент не участвует в авторизации вовсе: интерцепторы просто
    // не регистрируются. Так исключён и лишний заголовок на публичном
    // эндпоинте, и сброс чужой сессии по чужому 401.
    if (!auth) {
      return;
    }

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
          ...options?.headers,
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
        const parsed = parseErrorBody(error.response?.data);

        const errorMessage =
          parsed.message || error.message || `HTTP ${status || 'Error'}`;

        throw new ApiError(errorMessage, status, parsed.code ?? undefined);
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
