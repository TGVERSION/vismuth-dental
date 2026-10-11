// Интеграционный тест продления сессии: настоящие ApiClient, axios,
// axios-retry и authStore, подменён только транспорт (адаптер axios).
// Проверяет то, чего не видно в тестах `src/lib/auth-refresh.ts`:
// что интерцепторы действительно повторяют запрос с новым токеном.

import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

// Стор читает localStorage при создании, а клиент продлевает сессию только
// в браузере (`typeof window`). Оба должны существовать до импорта модулей,
// поэтому подставляются в hoisted-блоке — он выполняется раньше импортов.
const { storage } = vi.hoisted(() => {
  const data = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };

  vi.stubGlobal('localStorage', memoryStorage);
  vi.stubGlobal('window', {});

  return { storage: memoryStorage };
});

vi.mock('@/lib/logger', () => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { ApiClient, ApiError, registerSessionRefresh } from './base-client';
import { useAuthStore } from '@/store/authStore';
import { logWarn } from '@/lib/logger';

const STORAGE_KEY = 'auth-storage';

const USER = {
  id: 'user-1',
  login: 'doctor@example.com',
  first_name: 'Анна',
  last_name: 'Иванова',
  role: 'doctor' as const,
  role_name_ru: 'Врач',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: null,
  deleted_at: null,
};

/** Запрос, каким его увидел «сервер». */
interface SeenRequest {
  url: string;
  authorization: string | null;
  data: unknown;
}

type RefreshReply =
  | { status: 200; token: string }
  | { status: 401 }
  | { status: 'network' };

/** «Сервер»: какой access-токен он принимает и что отвечает на обновление. */
const server = {
  accepted: new Set<string>(),
  /** Отклонять любой токен, даже только что выданный. */
  rejectEveryToken: false,
  refreshReplies: [] as RefreshReply[],
  /** Задержка ответа на обновление, чтобы запросы успели встать в очередь. */
  refreshGate: null as Promise<void> | null,
  seen: [] as SeenRequest[],
};

const respond = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): Promise<AxiosResponse> => {
  const response: AxiosResponse = {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  };

  if (status >= 200 && status < 300) return Promise.resolve(response);

  return Promise.reject(
    new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      response,
    ),
  );
};

const adapter = async (
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> => {
  const url = config.url ?? '';
  const header = config.headers?.Authorization;
  const authorization = typeof header === 'string' ? header : null;

  server.seen.push({ url, authorization, data: config.data });

  if (url === '/auth/refresh') {
    if (server.refreshGate) await server.refreshGate;

    const reply = server.refreshReplies.shift() ?? { status: 401 };
    if (reply.status === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    if (reply.status === 401) {
      return respond(config, 401, {
        detail: 'Invalid or expired refresh token',
      });
    }

    server.accepted = new Set([reply.token]);
    return respond(config, 200, {
      access_token: reply.token,
      token_type: 'bearer',
      user: { id: USER.id, login: USER.login, role: 'doctor' },
    });
  }

  if (url === '/auth/login') {
    return respond(config, 401, { detail: 'Incorrect email or password' });
  }

  const token = authorization?.replace(/^Bearer /, '') ?? '';
  if (server.rejectEveryToken || !server.accepted.has(token)) {
    return respond(config, 401, { detail: 'Could not validate credentials' });
  }

  return respond(config, 200, { ok: true, url });
};

// Клиенты создаются после подмены транспорта: экземпляр axios копирует
// настройки по умолчанию в момент создания.
axios.defaults.adapter = adapter;

const client = new ApiClient({ baseUrl: '/api/main', retries: 0 });
const otherClient = new ApiClient({ baseUrl: '/api/main', retries: 0 });
const publicClient = new ApiClient({
  baseUrl: '/api/main',
  retries: 0,
  auth: false,
});
const sessionClient = new ApiClient({
  baseUrl: '/api/main',
  retries: 0,
  auth: false,
});

registerSessionRefresh(
  async () =>
    (await sessionClient.post<{ access_token: string }>('/auth/refresh'))
      .access_token,
);

const signIn = (token: string) => {
  useAuthStore.setState({
    user: USER,
    accessToken: token,
    isAuthenticated: true,
  });
};

const requestsTo = (url: string) =>
  server.seen.filter((request) => request.url === url);

const refreshCount = () => requestsTo('/auth/refresh').length;

beforeEach(() => {
  storage.clear();
  server.accepted = new Set();
  server.rejectEveryToken = false;
  server.refreshReplies = [];
  server.refreshGate = null;
  server.seen = [];
  (logWarn as Mock).mockClear();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('продление сессии в ApiClient', () => {
  it('действующий токен — запрос проходит без обновления', async () => {
    signIn('T1');
    server.accepted = new Set(['T1']);

    await expect(client.get('/protocols')).resolves.toEqual({
      ok: true,
      url: '/protocols',
    });
    expect(refreshCount()).toBe(0);
  });

  it('истёкший токен — одно обновление и повтор с новым токеном', async () => {
    signIn('T1');
    server.refreshReplies = [{ status: 200, token: 'T2' }];

    await expect(client.get('/protocols')).resolves.toEqual({
      ok: true,
      url: '/protocols',
    });

    expect(refreshCount()).toBe(1);
    expect(requestsTo('/protocols').map((r) => r.authorization)).toEqual([
      'Bearer T1',
      'Bearer T2',
    ]);
    expect(useAuthStore.getState().accessToken).toBe('T2');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    // Запрос обновления идёт без токена: backend читает только cookie.
    expect(requestsTo('/auth/refresh')[0].authorization).toBeNull();
  });

  it('параллельные запросы разных клиентов — одно обновление на всех', async () => {
    signIn('T1');
    server.refreshReplies = [{ status: 200, token: 'T2' }];
    let openGate!: () => void;
    server.refreshGate = new Promise<void>((resolve) => {
      openGate = resolve;
    });

    const calls = [
      client.get('/protocols'),
      client.get('/protocol-structures'),
      otherClient.get('/service_user'),
    ];
    // Все три запроса успевают получить 401, пока обновление не завершено.
    await new Promise((resolve) => setTimeout(resolve, 20));
    openGate();

    await expect(Promise.all(calls)).resolves.toHaveLength(3);
    expect(refreshCount()).toBe(1);
  });

  it('тело POST-запроса при повторе не меняется', async () => {
    signIn('T1');
    server.refreshReplies = [{ status: 200, token: 'T2' }];
    const body = { protocol_name: 'Осмотр', field_values: { a: 'текст' } };

    await client.post('/protocols', body);

    const attempts = requestsTo('/protocols');
    expect(attempts).toHaveLength(2);
    expect(attempts[1].data).toEqual(attempts[0].data);
    expect(JSON.parse(String(attempts[1].data))).toEqual(body);
  });

  it('неверный пароль на входе — обновления нет', async () => {
    const error = await client
      .post('/auth/login', { login: 'a@b.c', password: 'x' })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(refreshCount()).toBe(0);
  });

  it('refresh-сессии нет — авторизация сброшена, запрос отклонён с 401', async () => {
    signIn('T1');
    server.refreshReplies = [{ status: 401 }];

    const error = await client
      .get('/protocols')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(refreshCount()).toBe(1);
    expect(requestsTo('/protocols')).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('сбой связи при обновлении — авторизация цела, ошибка не 401', async () => {
    signIn('T1');
    server.refreshReplies = [{ status: 'network' }];

    const error = await client
      .get('/protocols')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    // Вызывающий код (запись приёма, автосохранение) должен счесть сбой
    // временным: статус 401 он трактует как конец сессии.
    expect((error as ApiError).status).toBeUndefined();
    expect(useAuthStore.getState().accessToken).toBe('T1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(logWarn).toHaveBeenCalledWith('Не удалось продлить сессию');
  });

  it('после сбоя связи следующий запрос продлевает сессию', async () => {
    signIn('T1');
    server.refreshReplies = [
      { status: 'network' },
      { status: 200, token: 'T2' },
    ];

    await client.get('/protocols').catch(() => undefined);
    await expect(client.get('/protocols')).resolves.toEqual({
      ok: true,
      url: '/protocols',
    });
    expect(refreshCount()).toBe(2);
  });

  it('сервер отклонил только что выданный токен — сброс без зацикливания', async () => {
    signIn('T1');
    // «Сервер» выдаёт T2, но принимать его не будет.
    server.refreshReplies = [{ status: 200, token: 'T2' }];
    server.rejectEveryToken = true;

    const error = await client
      .get('/protocols')
      .catch((reason: unknown) => reason);

    expect((error as ApiError).status).toBe(401);
    // Ровно одно обновление и две попытки запроса: исходная и повтор.
    expect(refreshCount()).toBe(1);
    expect(requestsTo('/protocols').map((r) => r.authorization)).toEqual([
      'Bearer T1',
      'Bearer T2',
    ]);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('клиент без авторизации не продлевает сессию и не сбрасывает её', async () => {
    signIn('T1');

    const error = await publicClient
      .get('/public/links/slug')
      .catch((reason: unknown) => reason);

    expect((error as ApiError).status).toBe(401);
    expect(refreshCount()).toBe(0);
    expect(useAuthStore.getState().accessToken).toBe('T1');
  });

  it('вкладка простаивала: подхваченный токен истёк — сессия продлена, а не сброшена', async () => {
    // Эта вкладка помнит совсем старый токен T0.
    signIn('T0');
    // Соседняя вкладка когда-то обновила токен до T1 — он тоже истёк.
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { user: USER, accessToken: 'T1', isAuthenticated: true },
        version: 0,
      }),
    );
    server.refreshReplies = [{ status: 200, token: 'T2' }];

    await expect(client.get('/protocols')).resolves.toEqual({
      ok: true,
      url: '/protocols',
    });

    expect(requestsTo('/protocols').map((r) => r.authorization)).toEqual([
      'Bearer T0',
      'Bearer T1',
      'Bearer T2',
    ]);
    expect(refreshCount()).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('T2');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('другая вкладка уже обновила токен — запроса обновления нет', async () => {
    signIn('T0');
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { user: USER, accessToken: 'T1', isAuthenticated: true },
        version: 0,
      }),
    );
    server.accepted = new Set(['T1']);

    await expect(client.get('/protocols')).resolves.toEqual({
      ok: true,
      url: '/protocols',
    });

    expect(refreshCount()).toBe(0);
    expect(useAuthStore.getState().accessToken).toBe('T1');
  });

  it('в другой вкладке вышли — запроса обновления нет, запрос отклонён', async () => {
    signIn('T1');
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { user: null, accessToken: null, isAuthenticated: false },
        version: 0,
      }),
    );

    const error = await client
      .get('/protocols')
      .catch((reason: unknown) => reason);

    expect((error as ApiError).status).toBe(401);
    expect(refreshCount()).toBe(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
