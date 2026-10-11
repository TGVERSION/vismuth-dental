// Продление сессии по refresh-cookie: решения без браузера, axios и стора.
//
// Backend выдаёт access JWT на 15 минут и refresh-токен в httpOnly-cookie.
// Когда access истёк, запрос получает 401: нужно один раз обновить сессию
// (`POST /auth/refresh`) и повторить запрос. Здесь собрано всё, что при этом
// решается: обновлять ли вообще, как не обновлять дважды и что делать с
// запросом после каждого исхода. Сеть, стор и блокировку передаёт вызывающий
// код (`src/api/base-client.ts`), поэтому модуль проверяется тестами в node.
//
// Почему обновлять дважды нельзя. Refresh-токен одноразовый: при обновлении
// backend отзывает старый и выдаёт новый. Повторное предъявление отозванного
// токена он считает кражей и отзывает ВСЕ сессии пользователя
// (`rotate_refresh_token` в `backend/app/services/refresh_tokens.py`).
// Два одновременных обновления с одной cookie — и врач разлогинен везде.

/**
 * Путь авторизации (`/auth/login`, `/auth/refresh`, …). Его 401 — ответ по
 * существу: неверный пароль, нет cookie. Обновлять сессию из-за него нельзя.
 */
export const isAuthEndpoint = (url: string | undefined): boolean =>
  typeof url === 'string' && /^\/?auth(\/|\?|$)/.test(url);

/** Токен из значения заголовка `Authorization: Bearer <токен>`. */
export const extractBearerToken = (header: unknown): string | null => {
  if (typeof header !== 'string') return null;

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
};

/**
 * Сколько раз один запрос можно повторить после 401. Два, а не один:
 * первый повтор может уйти с подхваченным токеном, который тоже истёк,
 * второй — уже с токеном, выданным сервером. Заодно это предел, который не
 * даёт запросу зациклиться при любой ошибке в логике.
 */
export const MAX_SESSION_RETRIES = 2;

export interface UnauthorizedContext {
  /** Путь запроса относительно базового адреса клиента. */
  url: string | undefined;
  /** Токен, с которым запрос ушёл и получил 401. */
  failedToken: string | null;
  /** Сколько раз этот запрос уже повторялся после 401. */
  retries: number;
  /** Повторялся ли он с токеном, который только что выдал сервер. */
  refreshedByServer: boolean;
}

export type UnauthorizedDecision = 'refresh' | 'reset';

/**
 * Что делать с 401: продлевать сессию или сбрасывать авторизацию.
 *
 * Сброс — когда продление не поможет: это сам путь авторизации; запрос
 * уходил без токена; сервер отклонил токен, который сам только что выдал;
 * исчерпан предел повторов.
 */
export const decideUnauthorized = (
  context: UnauthorizedContext,
): UnauthorizedDecision => {
  if (isAuthEndpoint(context.url)) return 'reset';
  if (!context.failedToken) return 'reset';
  if (context.refreshedByServer) return 'reset';
  if (context.retries >= MAX_SESSION_RETRIES) return 'reset';

  return 'refresh';
};

export type RefreshOutcome =
  /**
   * Есть токен, с которым запрос можно повторить.
   *
   * `fresh: true` — его только что выдал сервер. `fresh: false` — он взят
   * из стора или хранилища: его обновил параллельный запрос или другая
   * вкладка. Такой токен мог успеть истечь (вкладки простаивали дольше
   * срока его жизни), поэтому 401 на повторе с ним — не конец сессии,
   * а повод обновиться по-настоящему.
   */
  | { kind: 'refreshed'; token: string; fresh: boolean }
  /** Сессии нет: пользователь вышел либо refresh-токен не принят. */
  | { kind: 'expired' }
  /**
   * Обновить не удалось по причине, не связанной с сессией: сеть, 5xx.
   * Сессия может быть жива — сбрасывать авторизацию нельзя.
   */
  | { kind: 'failed'; error: unknown };

export interface SessionRefreshDeps {
  /** Access-токен в сторе этой вкладки. */
  getToken: () => string | null;
  /**
   * Перечитать стор из хранилища. У каждой вкладки своя копия стора в
   * памяти, и токен, обновлённый соседней вкладкой, виден только там.
   */
  syncFromStorage: () => void | Promise<void>;
  /** `POST /auth/refresh` → новый access-токен. Без автоматических повторов. */
  requestRefresh: () => Promise<string>;
  applyToken: (token: string) => void;
  clearSession: () => void;
  /** Выполнить задачу так, чтобы её не выполняли две вкладки сразу. */
  withLock: <T>(task: () => Promise<T>) => Promise<T>;
  /** Ошибка обновления означает «сессии нет» (401), а не сбой связи. */
  isUnauthorized: (error: unknown) => boolean;
}

export type SessionRefresher = (failedToken: string) => Promise<RefreshOutcome>;

/**
 * Собирает функцию продления сессии. Она гарантирует одно обновление на
 * вкладку (общий Promise) и одно на браузер (`withLock`), а токен, уже
 * обновлённый кем-то другим, подхватывает без запроса.
 */
export const createSessionRefresher = (
  deps: SessionRefreshDeps,
): SessionRefresher => {
  let inflight: Promise<RefreshOutcome> | null = null;

  /**
   * Не изменилась ли сессия относительно запроса, получившего 401.
   * `null` — токен в сторе тот же, обновление действительно нужно.
   */
  const adopt = (failedToken: string): RefreshOutcome | null => {
    const current = deps.getToken();
    if (!current) return { kind: 'expired' };
    if (current !== failedToken) {
      return { kind: 'refreshed', token: current, fresh: false };
    }

    return null;
  };

  const refreshUnderLock = async (
    failedToken: string,
  ): Promise<RefreshOutcome> => {
    // Пока вкладка ждала блокировку, соседняя могла уже обновить токен
    // (или выйти из аккаунта). Сбой чтения хранилища обновлению не мешает.
    try {
      await deps.syncFromStorage();
    } catch {
      // Работаем с тем, что есть в памяти.
    }

    const adopted = adopt(failedToken);
    if (adopted) return adopted;

    let token: string;
    try {
      token = await deps.requestRefresh();
    } catch (error) {
      if (!deps.isUnauthorized(error)) return { kind: 'failed', error };

      // Пока шёл запрос, пользователь мог выйти и войти заново: тогда
      // отказ относится к прежней сессии, а новую трогать нельзя.
      const changed = adopt(failedToken);
      if (changed) return changed;

      deps.clearSession();
      return { kind: 'expired' };
    }

    // То же самое при успехе: токен прежней сессии не должен «воскресить»
    // вышедшего пользователя или перезаписать токен нового.
    const changed = adopt(failedToken);
    if (changed) return changed;

    deps.applyToken(token);
    return { kind: 'refreshed', token, fresh: true };
  };

  return (failedToken) => {
    // Параллельный запрос уже обновил токен — запрос не нужен.
    const adopted = adopt(failedToken);
    if (adopted) return Promise.resolve(adopted);

    // Обновление уже идёт: все запросы, получившие 401, ждут его одно.
    if (inflight) return inflight;

    const run: Promise<RefreshOutcome> = deps
      .withLock(() => refreshUnderLock(failedToken))
      .catch((error: unknown): RefreshOutcome => ({ kind: 'failed', error }))
      .finally(() => {
        if (inflight === run) inflight = null;
      });

    inflight = run;
    return run;
  };
};

export interface UnauthorizedInput extends UnauthorizedContext {
  /** Исходная ошибка запроса со статусом 401. */
  error: unknown;
}

export interface UnauthorizedDeps {
  /** `null`, пока обработчик продления не зарегистрирован. */
  refresher: SessionRefresher | null;
  clearSession: () => void;
}

export type UnauthorizedResolution =
  /** Повторить запрос. `fresh` — см. `RefreshOutcome`. */
  | { action: 'retry'; fresh: boolean }
  /**
   * Отклонить запрос этой ошибкой. `refreshFailed` — продление сорвалось
   * из-за связи: тогда ошибка НЕ со статусом 401, чтобы вызывающий код
   * (запись приёма, автосохранение) счёл сбой временным и попробовал позже.
   */
  | { action: 'reject'; error: unknown; refreshFailed: boolean };

/** Что делать с запросом, получившим 401. */
export const resolveUnauthorized = async (
  input: UnauthorizedInput,
  deps: UnauthorizedDeps,
): Promise<UnauthorizedResolution> => {
  if (
    !deps.refresher ||
    !input.failedToken ||
    decideUnauthorized(input) === 'reset'
  ) {
    deps.clearSession();
    return { action: 'reject', error: input.error, refreshFailed: false };
  }

  const outcome = await deps.refresher(input.failedToken);

  switch (outcome.kind) {
    case 'refreshed':
      return { action: 'retry', fresh: outcome.fresh };
    case 'expired':
      return { action: 'reject', error: input.error, refreshFailed: false };
    case 'failed':
      return { action: 'reject', error: outcome.error, refreshFailed: true };
  }
};

/** Имя блокировки, общей для всех вкладок приложения. */
export const SESSION_LOCK_NAME = 'vismuth-auth-refresh';

/**
 * Сколько вкладка ждёт блокировку, мс. Заведомо больше таймаута запроса
 * обновления (15 с у `sessionApiClient` в `src/api/main-api.ts`): исправная
 * вкладка-владелец успеет закончить, и ожидание её не опередит.
 *
 * Предел нужен на случай, когда владелец не освободит блокировку вовсе —
 * браузер заморозил его вкладку посреди обновления (так делает мобильный
 * Safari). Без предела все запросы ожидающей вкладки, включая
 * автосохранение протокола, висели бы без ошибки.
 */
export const LOCK_WAIT_TIMEOUT_MS = 20_000;

/** Та часть Web Locks API, которая здесь нужна. */
export interface LockManagerLike {
  request: <T>(
    name: string,
    /** Отмена сигнала прекращает ожидание блокировки, но не саму задачу. */
    options: { signal: AbortSignal },
    callback: () => Promise<T>,
  ) => Promise<T>;
}

/**
 * Web Locks API этого браузера. Его нет в старых браузерах и вне
 * защищённого контекста — на стенде, открытом по `http://<IP>`.
 */
const browserLocks = (): LockManagerLike | null => {
  if (typeof navigator === 'undefined') return null;

  const locks = (navigator as { locks?: LockManager }).locks;
  if (!locks) return null;

  return {
    request: <T>(
      name: string,
      options: { signal: AbortSignal },
      callback: () => Promise<T>,
    ) => locks.request(name, options, callback) as Promise<T>,
  };
};

/**
 * Выполняет задачу под блокировкой, общей для вкладок. Без Web Locks API,
 * при отказе в блокировке или если её не дождались за `waitMs`, задача
 * выполняется без блокировки: внутри одной вкладки её и так защищает общий
 * Promise обновления.
 */
export const withCrossTabLock = <T>(
  task: () => Promise<T>,
  locks: LockManagerLike | null = browserLocks(),
  waitMs: number = LOCK_WAIT_TIMEOUT_MS,
): Promise<T> => {
  if (!locks) return task();

  let started = false;
  const waiting = new AbortController();
  const timer = setTimeout(() => waiting.abort(), waitMs);

  return locks
    .request(SESSION_LOCK_NAME, { signal: waiting.signal }, () => {
      started = true;
      clearTimeout(timer);
      return task();
    })
    .catch((error: unknown) => {
      // Ошибка самой задачи уходит вызывающему коду. А если блокировку не
      // дали или не дождались, задача ещё не запускалась — выполняем её
      // без блокировки.
      if (started) throw error;
      return task();
    })
    .finally(() => clearTimeout(timer));
};
