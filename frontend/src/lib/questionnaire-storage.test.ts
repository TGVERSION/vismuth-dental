import { describe, expect, it, vi } from 'vitest';
import {
  DEVICE_ID_KEY,
  browserStorage,
  clearSession,
  generateDeviceId,
  parseSession,
  readDeviceId,
  readSession,
  readSessionRaw,
  saveSession,
  type StorageLike,
} from './questionnaire-storage';

const memoryStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
};

const throwingStorage = (): StorageLike => ({
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
});

describe('readDeviceId', () => {
  it('создаёт идентификатор и сохраняет его', () => {
    const storage = memoryStorage();
    const id = readDeviceId(storage, () => 'device-1');

    expect(id).toBe('device-1');
    expect(storage.data.get(DEVICE_ID_KEY)).toBe('device-1');
  });

  it('повторное чтение возвращает тот же идентификатор', () => {
    const storage = memoryStorage();
    const generate = vi
      .fn<() => string>()
      .mockReturnValueOnce('device-1')
      .mockReturnValueOnce('device-2');

    expect(readDeviceId(storage, generate)).toBe('device-1');
    expect(readDeviceId(storage, generate)).toBe('device-1');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('без хранилища — сгенерированный идентификатор без исключения', () => {
    expect(readDeviceId(null, () => 'device-1')).toBe('device-1');
  });

  it('хранилище бросает — сгенерированный идентификатор без исключения', () => {
    expect(readDeviceId(throwingStorage(), () => 'device-1')).toBe('device-1');
  });

  it('слишком длинное значение заменяется новым', () => {
    const storage = memoryStorage();
    storage.data.set(DEVICE_ID_KEY, 'x'.repeat(500));

    expect(readDeviceId(storage, () => 'device-1')).toBe('device-1');
  });
});

describe('generateDeviceId', () => {
  it('даёт непустые разные значения', () => {
    const a = generateDeviceId();
    const b = generateDeviceId();

    expect(a).not.toBe('');
    expect(a).not.toBe(b);
  });
});

describe('browserStorage', () => {
  it('вне браузера — null', () => {
    expect(browserStorage('local')).toBeNull();
    expect(browserStorage('session')).toBeNull();
  });
});

describe('parseSession', () => {
  it('разбирает корректное значение', () => {
    expect(parseSession('{"id":"q-1","token":"t-1"}')).toEqual({
      id: 'q-1',
      token: 't-1',
    });
  });

  it('null, undefined и пустая строка — null', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession(undefined)).toBeNull();
    expect(parseSession('')).toBeNull();
  });

  it('битый JSON — null', () => {
    expect(parseSession('{id:')).toBeNull();
  });

  it('объект без token или с пустыми полями — null', () => {
    expect(parseSession('{"id":"q-1"}')).toBeNull();
    expect(parseSession('{"id":"","token":"t-1"}')).toBeNull();
    expect(parseSession('{"id":"q-1","token":42}')).toBeNull();
    expect(parseSession('"q-1"')).toBeNull();
    expect(parseSession('null')).toBeNull();
  });
});

describe('сохранённая анкета', () => {
  it('сохраняет, читает и очищает по slug', () => {
    const storage = memoryStorage();

    saveSession(storage, 'demo', { id: 'q-1', token: 't-1' });
    expect(readSession(storage, 'demo')).toEqual({ id: 'q-1', token: 't-1' });
    expect(readSession(storage, 'other')).toBeNull();

    clearSession(storage, 'demo');
    expect(readSession(storage, 'demo')).toBeNull();
  });

  it('сырое значение — строка, одинаковая при повторном чтении', () => {
    const storage = memoryStorage();
    saveSession(storage, 'demo', { id: 'q-1', token: 't-1' });

    const first = readSessionRaw(storage, 'demo');
    expect(typeof first).toBe('string');
    expect(readSessionRaw(storage, 'demo')).toBe(first);
  });

  it('битое значение отбрасывается и удаляется', () => {
    const storage = memoryStorage();
    storage.data.set('vismuth.questionnaire.demo', '{broken');

    expect(readSession(storage, 'demo')).toBeNull();
    expect(storage.data.has('vismuth.questionnaire.demo')).toBe(false);
  });

  it('нет хранилища или оно бросает — без исключений', () => {
    expect(readSessionRaw(null, 'demo')).toBeNull();
    expect(readSession(throwingStorage(), 'demo')).toBeNull();
    expect(() =>
      saveSession(throwingStorage(), 'demo', { id: 'q-1', token: 't-1' }),
    ).not.toThrow();
    expect(() => clearSession(throwingStorage(), 'demo')).not.toThrow();
  });
});
