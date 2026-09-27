import { describe, it, expect } from 'vitest';
import { decodeJwtExp, getTokenTimeLeftMs, hasEnoughSessionTime } from './jwt';

const base64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Токен с нужным payload. Подпись не проверяется, поэтому она произвольная. */
const makeToken = (payload: Record<string, unknown>): string =>
  [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify(payload)),
    'signature',
  ].join('.');

describe('decodeJwtExp', () => {
  it('читает exp и переводит его в миллисекунды', () => {
    const token = makeToken({ sub: 'user-1', exp: 1_800_000_000 });

    expect(decodeJwtExp(token)).toBe(1_800_000_000_000);
  });

  // Любой некорректный вход — это «срок неизвестен», а не исключение:
  // упасть на разборе токена посреди экрана протокола недопустимо.
  it('возвращает null на некорректном входе', () => {
    expect(decodeJwtExp(null)).toBeNull();
    expect(decodeJwtExp(undefined)).toBeNull();
    expect(decodeJwtExp('')).toBeNull();
    expect(decodeJwtExp('не токен')).toBeNull();
    expect(decodeJwtExp('a.b')).toBeNull();
    expect(decodeJwtExp('a.!!!.c')).toBeNull();
  });

  it('возвращает null, если exp отсутствует или не число', () => {
    expect(decodeJwtExp(makeToken({ sub: 'user-1' }))).toBeNull();
    expect(decodeJwtExp(makeToken({ exp: 'soon' }))).toBeNull();
  });
});

describe('getTokenTimeLeftMs', () => {
  it('считает остаток до истечения', () => {
    const now = 1_800_000_000_000;
    const token = makeToken({ exp: 1_800_000_000 + 600 });

    expect(getTokenTimeLeftMs(token, now)).toBe(600_000);
  });

  it('для истёкшего токена даёт ноль, а не отрицательное число', () => {
    const now = 1_800_000_000_000;
    const token = makeToken({ exp: 1_800_000_000 - 600 });

    expect(getTokenTimeLeftMs(token, now)).toBe(0);
  });

  it('возвращает null, когда срок неизвестен', () => {
    expect(getTokenTimeLeftMs('мусор')).toBeNull();
  });
});

describe('hasEnoughSessionTime', () => {
  const now = 1_800_000_000_000;

  it('видит достаточный запас', () => {
    const token = makeToken({ exp: 1_800_000_000 + 3600 });

    expect(hasEnoughSessionTime(token, 45 * 60_000, now)).toBe(true);
  });

  it('видит нехватку запаса', () => {
    const token = makeToken({ exp: 1_800_000_000 + 600 });

    expect(hasEnoughSessionTime(token, 45 * 60_000, now)).toBe(false);
  });

  // Не смогли прочитать токен — не мешаем врачу начать запись.
  it('считает неизвестный срок достаточным', () => {
    expect(hasEnoughSessionTime('мусор', 45 * 60_000, now)).toBe(true);
  });
});
