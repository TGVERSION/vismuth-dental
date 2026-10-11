import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SESSION_RETRIES,
  SESSION_LOCK_NAME,
  createSessionRefresher,
  decideUnauthorized,
  extractBearerToken,
  isAuthEndpoint,
  resolveUnauthorized,
  withCrossTabLock,
  type LockManagerLike,
  type RefreshOutcome,
  type SessionRefresher,
} from './auth-refresh';

/** Отказ сервера обновить сессию: `401` от `/auth/refresh`. */
class Unauthorized extends Error {}

/** Обещание, которым управляет тест: он сам решает, когда придёт ответ. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

/** Дать отработать уже поставленным в очередь продолжениям. */
const flush = async () => {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

interface SetupOptions {
  /** Токен в сторе вкладки. */
  token: string | null;
  /** Ответ `/auth/refresh`. По умолчанию — новый токен `T2`. */
  refresh?: () => Promise<string>;
  /**
   * Что лежит в хранилище в момент перечитывания. `undefined` — то же, что
   * в памяти (другие вкладки ничего не меняли).
   */
  stored?: () => string | null | undefined;
}

const setup = ({ token, refresh, stored }: SetupOptions) => {
  const state = { token };
  const events: string[] = [];

  const requestRefresh = vi.fn(async () => {
    events.push('request');
    return refresh ? refresh() : 'T2';
  });
  const applyToken = vi.fn((next: string) => {
    state.token = next;
  });
  const clearSession = vi.fn(() => {
    state.token = null;
  });
  const syncFromStorage = vi.fn(() => {
    events.push('sync');
    const value = stored?.();
    if (value !== undefined) state.token = value;
  });

  const refresher = createSessionRefresher({
    getToken: () => state.token,
    syncFromStorage,
    requestRefresh,
    applyToken,
    clearSession,
    withLock: async (task) => {
      events.push('lock');
      try {
        return await task();
      } finally {
        events.push('unlock');
      }
    },
    isUnauthorized: (error) => error instanceof Unauthorized,
  });

  return {
    state,
    events,
    refresher,
    requestRefresh,
    applyToken,
    clearSession,
    syncFromStorage,
  };
};

describe('isAuthEndpoint', () => {
  it('пути авторизации', () => {
    expect(isAuthEndpoint('/auth/login')).toBe(true);
    expect(isAuthEndpoint('/auth/refresh')).toBe(true);
    expect(isAuthEndpoint('/auth/logout')).toBe(true);
    expect(isAuthEndpoint('/auth/register/confirm')).toBe(true);
    expect(isAuthEndpoint('auth/login')).toBe(true);
    expect(isAuthEndpoint('/auth')).toBe(true);
    expect(isAuthEndpoint('/auth?next=1')).toBe(true);
  });

  it('остальные пути', () => {
    expect(isAuthEndpoint('/protocols')).toBe(false);
    expect(isAuthEndpoint('/service_user')).toBe(false);
    // Похожее начало — не путь авторизации.
    expect(isAuthEndpoint('/authors')).toBe(false);
    expect(isAuthEndpoint('/me/auth/login')).toBe(false);
    expect(isAuthEndpoint('')).toBe(false);
    expect(isAuthEndpoint(undefined)).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('достаёт токен из заголовка', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer  abc ')).toBe('abc');
  });

  it('нет заголовка или это не Bearer', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
    expect(extractBearerToken(42)).toBeNull();
  });
});

describe('decideUnauthorized', () => {
  const base = {
    url: '/protocols',
    failedToken: 'T1',
    retries: 0,
    refreshedByServer: false,
  };

  it('обычный запрос с истёкшим токеном — продлевать', () => {
    expect(decideUnauthorized(base)).toBe('refresh');
  });

  it('повтор с подхваченным токеном снова дал 401 — продлевать', () => {
    expect(decideUnauthorized({ ...base, retries: 1 })).toBe('refresh');
  });

  it('путь авторизации — сброс: 401 там ответ по существу', () => {
    expect(decideUnauthorized({ ...base, url: '/auth/login' })).toBe('reset');
    expect(decideUnauthorized({ ...base, url: '/auth/refresh' })).toBe('reset');
  });

  it('запрос уходил без токена — сброс', () => {
    expect(decideUnauthorized({ ...base, failedToken: null })).toBe('reset');
  });

  it('сервер отклонил токен, который сам только что выдал, — сброс', () => {
    expect(
      decideUnauthorized({ ...base, retries: 1, refreshedByServer: true }),
    ).toBe('reset');
  });

  it('предел повторов исчерпан — сброс', () => {
    expect(
      decideUnauthorized({ ...base, retries: MAX_SESSION_RETRIES }),
    ).toBe('reset');
  });
});

describe('createSessionRefresher', () => {
  it('обновляет токен одним запросом под блокировкой', async () => {
    const h = setup({ token: 'T1' });

    await expect(h.refresher('T1')).resolves.toEqual({
      kind: 'refreshed',
      token: 'T2',
      fresh: true,
    });

    expect(h.requestRefresh).toHaveBeenCalledTimes(1);
    expect(h.applyToken).toHaveBeenCalledWith('T2');
    expect(h.state.token).toBe('T2');
    expect(h.clearSession).not.toHaveBeenCalled();
    // Хранилище перечитывается и запрос уходит внутри блокировки.
    expect(h.events).toEqual(['lock', 'sync', 'request', 'unlock']);
  });

  it('параллельные вызовы ждут одно обновление', async () => {
    const response = deferred<string>();
    const h = setup({ token: 'T1', refresh: () => response.promise });

    const calls = [h.refresher('T1'), h.refresher('T1'), h.refresher('T1')];
    await flush();
    expect(h.requestRefresh).toHaveBeenCalledTimes(1);

    response.resolve('T2');
    const outcomes = await Promise.all(calls);

    expect(h.requestRefresh).toHaveBeenCalledTimes(1);
    for (const outcome of outcomes) {
      expect(outcome).toEqual({ kind: 'refreshed', token: 'T2', fresh: true });
    }
  });

  it('токен уже сменил параллельный запрос — без обращения к серверу', async () => {
    const h = setup({ token: 'T2' });

    await expect(h.refresher('T1')).resolves.toEqual({
      kind: 'refreshed',
      token: 'T2',
      fresh: false,
    });

    expect(h.requestRefresh).not.toHaveBeenCalled();
    expect(h.events).toEqual([]);
  });

  it('пользователь уже вышел — сессии нет, запроса нет', async () => {
    const h = setup({ token: null });

    await expect(h.refresher('T1')).resolves.toEqual({ kind: 'expired' });

    expect(h.requestRefresh).not.toHaveBeenCalled();
    expect(h.clearSession).not.toHaveBeenCalled();
  });

  it('токен обновила другая вкладка — подхватывает его без запроса', async () => {
    const h = setup({ token: 'T1', stored: () => 'T2' });

    await expect(h.refresher('T1')).resolves.toEqual({
      kind: 'refreshed',
      token: 'T2',
      fresh: false,
    });

    expect(h.syncFromStorage).toHaveBeenCalledTimes(1);
    expect(h.requestRefresh).not.toHaveBeenCalled();
    expect(h.applyToken).not.toHaveBeenCalled();
  });

  it('в другой вкладке вышли из аккаунта — сессии нет, запроса нет', async () => {
    const h = setup({ token: 'T1', stored: () => null });

    await expect(h.refresher('T1')).resolves.toEqual({ kind: 'expired' });

    expect(h.requestRefresh).not.toHaveBeenCalled();
  });

  it('сервер не принял refresh-токен — авторизация сброшена', async () => {
    const h = setup({
      token: 'T1',
      refresh: () => Promise.reject(new Unauthorized()),
    });

    await expect(h.refresher('T1')).resolves.toEqual({ kind: 'expired' });

    expect(h.clearSession).toHaveBeenCalledTimes(1);
    expect(h.applyToken).not.toHaveBeenCalled();
  });

  it('сбой связи при обновлении — авторизация не тронута', async () => {
    const networkError = new Error('Network Error');
    const h = setup({
      token: 'T1',
      refresh: () => Promise.reject(networkError),
    });

    await expect(h.refresher('T1')).resolves.toEqual({
      kind: 'failed',
      error: networkError,
    });

    expect(h.clearSession).not.toHaveBeenCalled();
    expect(h.applyToken).not.toHaveBeenCalled();
    expect(h.state.token).toBe('T1');
  });

  it('вышли, пока шёл запрос, — новый токен не применяется', async () => {
    const response = deferred<string>();
    const h = setup({ token: 'T1', refresh: () => response.promise });

    const call = h.refresher('T1');
    await flush();
    h.state.token = null;
    response.resolve('T2');

    await expect(call).resolves.toEqual({ kind: 'expired' });
    expect(h.applyToken).not.toHaveBeenCalled();
    expect(h.state.token).toBeNull();
  });

  it('вошли заново, пока шёл запрос, — новая сессия не перезаписана', async () => {
    const response = deferred<string>();
    const h = setup({ token: 'T1', refresh: () => response.promise });

    const call = h.refresher('T1');
    await flush();
    h.state.token = 'T-new-login';
    response.resolve('T2');

    await expect(call).resolves.toEqual({
      kind: 'refreshed',
      token: 'T-new-login',
      fresh: false,
    });
    expect(h.applyToken).not.toHaveBeenCalled();
    expect(h.state.token).toBe('T-new-login');
  });

  it('вошли заново, а обновление прежней сессии отклонено — новую не сбрасывает', async () => {
    const response = deferred<string>();
    const h = setup({ token: 'T1', refresh: () => response.promise });

    const call = h.refresher('T1');
    await flush();
    h.state.token = 'T-new-login';
    response.reject(new Unauthorized());

    await expect(call).resolves.toEqual({
      kind: 'refreshed',
      token: 'T-new-login',
      fresh: false,
    });
    expect(h.clearSession).not.toHaveBeenCalled();
  });

  it('после завершения следующий вызов обновляет заново', async () => {
    let issued = 1;
    const h = setup({
      token: 'T1',
      refresh: async () => {
        issued += 1;
        return `T${issued}`;
      },
    });

    await h.refresher('T1');
    await expect(h.refresher('T2')).resolves.toEqual({
      kind: 'refreshed',
      token: 'T3',
      fresh: true,
    });

    expect(h.requestRefresh).toHaveBeenCalledTimes(2);
  });

  it('после сбоя связи следующий вызов пробует снова', async () => {
    let attempt = 0;
    const h = setup({
      token: 'T1',
      refresh: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('Network Error');
        return 'T2';
      },
    });

    expect((await h.refresher('T1')).kind).toBe('failed');
    await expect(h.refresher('T1')).resolves.toEqual({
      kind: 'refreshed',
      token: 'T2',
      fresh: true,
    });
  });

  it('сбой чтения хранилища не мешает обновлению', async () => {
    const h = setup({
      token: 'T1',
      stored: () => {
        throw new Error('storage unavailable');
      },
    });

    await expect(h.refresher('T1')).resolves.toEqual({
      kind: 'refreshed',
      token: 'T2',
      fresh: true,
    });
  });

  it('сбой блокировки — исход «не удалось», авторизация цела', async () => {
    const lockError = new Error('lock failed');
    const state = { token: 'T1' as string | null };
    const clearSession = vi.fn();
    const refresher = createSessionRefresher({
      getToken: () => state.token,
      syncFromStorage: () => {},
      requestRefresh: async () => 'T2',
      applyToken: () => {},
      clearSession,
      withLock: () => Promise.reject(lockError),
      isUnauthorized: () => false,
    });

    await expect(refresher('T1')).resolves.toEqual({
      kind: 'failed',
      error: lockError,
    });
    expect(clearSession).not.toHaveBeenCalled();
  });
});

describe('resolveUnauthorized', () => {
  const originalError = new Error('Request failed with status code 401');
  const input = {
    url: '/protocols',
    failedToken: 'T1' as string | null,
    retries: 0,
    refreshedByServer: false,
    error: originalError,
  };

  const refresherReturning = (outcome: RefreshOutcome) =>
    vi.fn<SessionRefresher>(async () => outcome);

  it('токен обновлён — повторить запрос', async () => {
    const clearSession = vi.fn();
    const refresher = refresherReturning({
      kind: 'refreshed',
      token: 'T2',
      fresh: true,
    });

    await expect(
      resolveUnauthorized(input, { refresher, clearSession }),
    ).resolves.toEqual({ action: 'retry', fresh: true });

    expect(refresher).toHaveBeenCalledWith('T1');
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('токен подхвачен — повторить, но свежим его не считать', async () => {
    const refresher = refresherReturning({
      kind: 'refreshed',
      token: 'T2',
      fresh: false,
    });

    await expect(
      resolveUnauthorized(input, { refresher, clearSession: vi.fn() }),
    ).resolves.toEqual({ action: 'retry', fresh: false });
  });

  it('сессии нет — исходная ошибка 401', async () => {
    const refresher = refresherReturning({ kind: 'expired' });

    await expect(
      resolveUnauthorized(input, { refresher, clearSession: vi.fn() }),
    ).resolves.toEqual({
      action: 'reject',
      error: originalError,
      refreshFailed: false,
    });
  });

  it('сбой связи при обновлении — ошибка обновления, а не 401', async () => {
    const networkError = new Error('Network Error');
    const clearSession = vi.fn();
    const refresher = refresherReturning({
      kind: 'failed',
      error: networkError,
    });

    await expect(
      resolveUnauthorized(input, { refresher, clearSession }),
    ).resolves.toEqual({
      action: 'reject',
      error: networkError,
      refreshFailed: true,
    });
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('путь авторизации — сброс без обновления', async () => {
    const clearSession = vi.fn();
    const refresher = refresherReturning({ kind: 'expired' });

    await expect(
      resolveUnauthorized(
        { ...input, url: '/auth/login' },
        { refresher, clearSession },
      ),
    ).resolves.toEqual({
      action: 'reject',
      error: originalError,
      refreshFailed: false,
    });

    expect(refresher).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('запрос без токена — сброс без обновления', async () => {
    const clearSession = vi.fn();
    const refresher = refresherReturning({ kind: 'expired' });

    await resolveUnauthorized(
      { ...input, failedToken: null },
      { refresher, clearSession },
    );

    expect(refresher).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('обработчик не зарегистрирован — прежнее поведение: сброс', async () => {
    const clearSession = vi.fn();

    await expect(
      resolveUnauthorized(input, { refresher: null, clearSession }),
    ).resolves.toEqual({
      action: 'reject',
      error: originalError,
      refreshFailed: false,
    });
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('отклонён свежий токен — сброс, второго обновления нет', async () => {
    const clearSession = vi.fn();
    const refresher = refresherReturning({ kind: 'expired' });

    await resolveUnauthorized(
      { ...input, failedToken: 'T2', retries: 1, refreshedByServer: true },
      { refresher, clearSession },
    );

    expect(refresher).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});

describe('простаивавшие вкладки', () => {
  // Вкладка А обновила токен и замолчала; он тоже успел истечь. Врач
  // вернулся во вкладку Б со совсем старым токеном. Подхваченный токен
  // вкладки А не должен стоить врачу сессии: refresh-cookie ещё жива.
  it('подхваченный токен истёк — обновляется по-настоящему, сессия цела', async () => {
    const h = setup({ token: 'T0', stored: () => 'T1' });
    const error = new Error('401');
    const deps = { refresher: h.refresher, clearSession: h.clearSession };

    // Первый 401: запрос уходил с T0, в хранилище лежит T1 вкладки А.
    const first = await resolveUnauthorized(
      {
        url: '/protocols',
        failedToken: 'T0',
        retries: 0,
        refreshedByServer: false,
        error,
      },
      deps,
    );
    expect(first).toEqual({ action: 'retry', fresh: false });
    expect(h.requestRefresh).not.toHaveBeenCalled();

    // Повтор с T1 снова получил 401: теперь обновление настоящее.
    const second = await resolveUnauthorized(
      {
        url: '/protocols',
        failedToken: 'T1',
        retries: 1,
        refreshedByServer: false,
        error,
      },
      deps,
    );
    expect(second).toEqual({ action: 'retry', fresh: true });
    expect(h.requestRefresh).toHaveBeenCalledTimes(1);
    expect(h.state.token).toBe('T2');
    expect(h.clearSession).not.toHaveBeenCalled();

    // Если сервер отклонит и свежий токен — тогда уже сброс.
    const third = await resolveUnauthorized(
      {
        url: '/protocols',
        failedToken: 'T2',
        retries: 2,
        refreshedByServer: true,
        error,
      },
      deps,
    );
    expect(third).toEqual({
      action: 'reject',
      error,
      refreshFailed: false,
    });
    expect(h.clearSession).toHaveBeenCalledTimes(1);
    expect(h.requestRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('withCrossTabLock', () => {
  it('без Web Locks API задача выполняется сразу', async () => {
    const task = vi.fn(async () => 'готово');

    await expect(withCrossTabLock(task, null)).resolves.toBe('готово');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('с Web Locks API задача выполняется под общей блокировкой', async () => {
    const names: string[] = [];
    const locks: LockManagerLike = {
      request: (name, _options, callback) => {
        names.push(name);
        return callback();
      },
    };
    const task = vi.fn(async () => 'готово');

    await expect(withCrossTabLock(task, locks)).resolves.toBe('готово');
    expect(names).toEqual([SESSION_LOCK_NAME]);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('блокировку не дали — задача выполняется без неё, один раз', async () => {
    const locks: LockManagerLike = {
      request: () => Promise.reject(new Error('SecurityError')),
    };
    const task = vi.fn(async () => 'готово');

    await expect(withCrossTabLock(task, locks)).resolves.toBe('готово');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('ошибка самой задачи не приводит к повторному запуску', async () => {
    const locks: LockManagerLike = {
      request: (_name, _options, callback) => callback(),
    };
    const failure = new Error('сбой задачи');
    const task = vi.fn(async () => {
      throw failure;
    });

    await expect(withCrossTabLock(task, locks)).rejects.toBe(failure);
    expect(task).toHaveBeenCalledTimes(1);
  });

  describe('предел ожидания', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * Блокировку держит замороженная вкладка: её не дадут, пока ожидание
     * не отменят сигналом, — как настоящий Web Locks API.
     */
    const stuckLocks = (): LockManagerLike => ({
      request: (_name, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The request was aborted', 'AbortError'));
          });
        }),
    });

    it('блокировку не дождались — задача выполняется без неё', async () => {
      const task = vi.fn(async () => 'готово');

      const result = withCrossTabLock(task, stuckLocks(), 20_000);

      await vi.advanceTimersByTimeAsync(19_999);
      expect(task).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toBe('готово');
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('блокировку дали вовремя — ожидание больше не отменяется', async () => {
      let waitSignal: AbortSignal | null = null;
      const locks: LockManagerLike = {
        request: (_name, { signal }, callback) => {
          waitSignal = signal;
          return callback();
        },
      };
      // Задача длится дольше предела ожидания: сам предел её не касается.
      const task = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('готово'), 60_000);
          }),
      );

      const result = withCrossTabLock(task, locks, 20_000);
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(result).resolves.toBe('готово');
      expect(task).toHaveBeenCalledTimes(1);
      expect((waitSignal as AbortSignal | null)?.aborted).toBe(false);
    });
  });
});
