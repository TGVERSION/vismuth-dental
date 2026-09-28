// Браузерное хранилище анкеты пациента.
//
// Что и зачем хранится:
// - `localStorage` — случайный идентификатор устройства для заголовка
//   `X-Device-Id`: по нему backend считает лимит анкет с устройства;
// - `sessionStorage` — `id` и `token` начатой анкеты, чтобы перезагрузка
//   страницы продолжила её с текущего шага (решение 5).
//
// Ответы пациента, имя и дата приёма сюда не пишутся никогда: это сведения
// о здоровье, их хранит только backend.
//
// Хранилище передаётся аргументом — так модуль проверяется тестами без
// браузера. Любое обращение обёрнуто в try/catch: приватный режим и запрет
// хранилища не должны ломать анкету.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DEVICE_ID_KEY = 'vismuth.questionnaire.device';

const SESSION_KEY_PREFIX = 'vismuth.questionnaire.';

/** Предел длины идентификатора из хранилища: чужое длинное значение не шлём. */
const DEVICE_ID_MAX_LENGTH = 128;

/**
 * Хранилище браузера или `null`. Само обращение к `window.localStorage`
 * бросает исключение, когда хранилище запрещено настройками.
 */
export const browserStorage = (
  kind: 'local' | 'session',
): StorageLike | null => {
  if (typeof window === 'undefined') return null;

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Случайный идентификатор. `crypto.randomUUID` есть только в защищённом
 * контексте (HTTPS или localhost), поэтому есть запасные пути.
 */
export const generateDeviceId = (): string => {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Постоянный идентификатор устройства. Нет хранилища или оно бросает —
 * сгенерированный идентификатор без исключения. Вызывающий код держит
 * результат на всю загрузку страницы: иначе без хранилища каждый старт
 * приходил бы с «новым устройством».
 */
export const readDeviceId = (
  storage: StorageLike | null,
  generate: () => string,
): string => {
  try {
    const existing = storage?.getItem(DEVICE_ID_KEY);
    if (existing && existing.length <= DEVICE_ID_MAX_LENGTH) return existing;
  } catch {
    // Хранилище недоступно — идентификатор будет только на эту страницу.
  }

  const id = generate();
  try {
    storage?.setItem(DEVICE_ID_KEY, id);
  } catch {
    // Не сохранилось — не критично, лимит устройства просто обойдётся.
  }

  return id;
};

/** Начатая анкета: достаточно, чтобы продолжить её после перезагрузки. */
export interface StoredQuestionnaire {
  id: string;
  token: string;
}

const sessionKey = (slug: string): string => `${SESSION_KEY_PREFIX}${slug}`;

/**
 * Сырая строка сохранённой анкеты. Именно строка, а не объект: это снимок
 * для `useSyncExternalStore`, и новый объект на каждом чтении зациклил бы
 * рендер.
 */
export const readSessionRaw = (
  storage: StorageLike | null,
  slug: string,
): string | null => {
  try {
    return storage?.getItem(sessionKey(slug)) ?? null;
  } catch {
    return null;
  }
};

/** Разбор сохранённой анкеты. Всё, что не `{ id, token }` со строками, — null. */
export const parseSession = (
  raw: string | null | undefined,
): StoredQuestionnaire | null => {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const { id, token } = parsed as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof token !== 'string' || token === '') return null;

  return { id, token };
};

export const saveSession = (
  storage: StorageLike | null,
  slug: string,
  session: StoredQuestionnaire,
): void => {
  try {
    storage?.setItem(
      sessionKey(slug),
      JSON.stringify({ id: session.id, token: session.token }),
    );
  } catch {
    // Не сохранилось — анкета работает, но перезагрузка начнёт её заново.
  }
};

export const clearSession = (
  storage: StorageLike | null,
  slug: string,
): void => {
  try {
    storage?.removeItem(sessionKey(slug));
  } catch {
    // Нечего делать: значение останется и будет отброшено при следующем чтении.
  }
};

/** Сохранённая анкета; битое значение удаляется. */
export const readSession = (
  storage: StorageLike | null,
  slug: string,
): StoredQuestionnaire | null => {
  const raw = readSessionRaw(storage, slug);
  const parsed = parseSession(raw);
  if (raw !== null && parsed === null) clearSession(storage, slug);

  return parsed;
};
