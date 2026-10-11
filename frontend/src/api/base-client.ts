import { useAuthStore } from '@/store/authStore';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import { logWarn } from '@/lib/logger';
import { parseErrorBody } from '@/lib/api-error';
import {
  createSessionRefresher,
  extractBearerToken,
  resolveUnauthorized,
  withCrossTabLock,
  type SessionRefresher,
} from '@/lib/auth-refresh';

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

// ---------------------------------------------------------------------------
// Продление сессии
//
// Access-токен живёт 15 минут, сессию продлевает refresh-токен в
// httpOnly-cookie (`POST /auth/refresh`). Получив 401, клиент с авторизацией
// обновляет токен и повторяет запрос. Решения — в `src/lib/auth-refresh.ts`
// (там же объяснено, почему обновление должно быть ровно одно); здесь только
// связь со стором и axios.
//
// Обработчик один на все клиенты: 401 одновременно приходит запросам разных
// клиентов, а обновление у них должно быть общее.

/** Отметки на конфигурации запроса: что с ним уже делали после 401. */
interface SessionRequestConfig extends InternalAxiosRequestConfig {
  /** Сколько раз запрос повторялся после 401. */
  _sessionRetries?: number;
  /** Повторялся ли он с токеном, который только что выдал сервер. */
  _sessionRefreshed?: boolean;
}

let sessionRefresher: SessionRefresher | null = null;

/**
 * Подключает продление сессии. `requestRefresh` — сетевой запрос обновления;
 * он объявлен в `main-api.ts` и передаётся сюда, потому что этот модуль
 * не может импортировать `main-api.ts` (получился бы цикл).
 *
 * Запрос обязан идти клиентом без авторизации (иначе его собственный 401
 * запустил бы обновление заново) и без повторов (повтор отзывает все сессии).
 */
export const registerSessionRefresh = (
  requestRefresh: () => Promise<string>,
): void => {
  sessionRefresher = createSessionRefresher({
    getToken: () => useAuthStore.getState().accessToken,
    // Стор каждой вкладки живёт в её памяти: токен, обновлённый соседней
    // вкладкой, виден только в localStorage. На сервере `persist` нет.
    syncFromStorage: () => useAuthStore.persist?.rehydrate(),
    requestRefresh,
    applyToken: (token) => useAuthStore.getState().setAccessToken(token),
    clearSession: () => useAuthStore.getState().clearAuth(),
    withLock: withCrossTabLock,
    isUnauthorized: (error) =>
      error instanceof ApiError && error.status === 401,
  });
};

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
   * в Ассистенте. Такой клиент не продлевает сессию по 401 — поэтому им же
   * отправляется сам запрос обновления.
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
      async (error: AxiosError) => {
        const config = error.config as SessionRequestConfig | undefined;

        if (
          error.response?.status !== 401 ||
          typeof window === 'undefined' ||
          !config
        ) {
          return Promise.reject(error);
        }

        // 401 — access-токен истёк либо сессии нет. Сначала пробуем продлить
        // сессию; авторизация сбрасывается, только когда продлевать нечего.
        // Переход на /login после сброса выполнит ProtectedRoute средствами
        // роутера — без жёсткой перезагрузки, которая теряет несохранённые
        // правки протокола.
        const resolution = await resolveUnauthorized(
          {
            url: config.url,
            // Токен берём из заголовка запроса, а не из стора: пока запрос
            // был в пути, стор мог обновиться, и по нему не понять, с чем
            // запрос уходил.
            failedToken: extractBearerToken(config.headers?.Authorization),
            retries: config._sessionRetries ?? 0,
            refreshedByServer: config._sessionRefreshed ?? false,
            error,
          },
          {
            refresher: sessionRefresher,
            clearSession: () => useAuthStore.getState().clearAuth(),
          },
        );

        if (resolution.action === 'reject') {
          if (resolution.refreshFailed) {
            // Только метка: ни токенов, ни тела ответа в лог не передаём.
            logWarn('Не удалось продлить сессию');
          }
          return Promise.reject(resolution.error);
        }

        // Повтор безопасен и для POST: 401 значит, что backend запрос не
        // выполнял. Актуальный токен подставит интерцептор запроса.
        config._sessionRetries = (config._sessionRetries ?? 0) + 1;
        config._sessionRefreshed =
          (config._sessionRefreshed ?? false) || resolution.fresh;

        return this.client.request(config);
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
