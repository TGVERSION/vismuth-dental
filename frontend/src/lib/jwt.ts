// Чтение срока жизни токена на клиенте.
//
// Нужно ровно для одного сценария: перед записью приёма предупредить врача,
// что сессия истечёт раньше, чем закончится консультация. Токен живёт
// 60 минут и не обновляется — если он протухнет посреди приёма, 401 сбросит
// авторизацию, экран протокола размонтируется и запись оборвётся.
//
// Это только подсказка для UI. Ни решения о доступе, ни проверки подписи
// здесь нет и быть не может: подпись проверяет backend.

/** Полезная нагрузка токена в части, которая нас интересует. */
interface JwtPayload {
  exp?: unknown;
}

const decodeBase64Url = (value: string): string | null => {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    return atob(padded);
  } catch {
    return null;
  }
};

/**
 * Момент истечения токена в миллисекундах epoch или `null`, если его нельзя
 * прочитать. `null` — это не ошибка: значит, предупреждать не о чем и UI
 * ведёт себя как обычно.
 */
export const decodeJwtExp = (
  token: string | null | undefined,
): number | null => {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const json = decodeBase64Url(parts[1]);
  if (!json) return null;

  try {
    const payload = JSON.parse(json) as JwtPayload;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }
    // В токене `exp` в секундах, в браузере удобнее миллисекунды.
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

/**
 * Сколько осталось до истечения токена, мс. `null` — срок неизвестен.
 * Истёкший токен даёт 0, а не отрицательное число: вызывающему коду важно
 * лишь то, что запаса нет.
 */
export const getTokenTimeLeftMs = (
  token: string | null | undefined,
  now: number = Date.now(),
): number | null => {
  const expiresAt = decodeJwtExp(token);
  if (expiresAt === null) return null;

  return Math.max(0, expiresAt - now);
};

/**
 * Хватит ли запаса сессии на приём.
 * Неизвестный срок считается достаточным: мешать работе врача из-за того,
 * что не удалось прочитать токен, нельзя.
 */
export const hasEnoughSessionTime = (
  token: string | null | undefined,
  requiredMs: number,
  now: number = Date.now(),
): boolean => {
  const left = getTokenTimeLeftMs(token, now);
  if (left === null) return true;

  return left >= requiredMs;
};
