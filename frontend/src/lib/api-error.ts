// Разбор тела ошибки backend. Вынесен из base-client.ts, чтобы проверяться
// тестами без axios и authStore.
//
// Backend отдаёт ошибку в трёх видах:
// - `detail: 'текст'` — обычный HTTPException;
// - `detail: { code, message }` — отказ с машинным кодом (лимиты анкеты
//   пациента: device_limit, ip_limit, subscription_expired, …). Без кода
//   фронтенд не отличит лимит устройства от лимита адреса, а тексты экранов
//   у них разные;
// - `detail: [{ msg, … }]` — ошибка валидации FastAPI (422).

export interface ParsedErrorBody {
  message: string | null;
  code: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

export const parseErrorBody = (data: unknown): ParsedErrorBody => {
  if (!isRecord(data)) return { message: null, code: null };

  // `message` важнее `detail` — так было и до разбора кода.
  const message = nonEmptyString(data.message);
  const { detail } = data;

  if (typeof detail === 'string') {
    return { message: message ?? nonEmptyString(detail), code: null };
  }

  if (isRecord(detail)) {
    return {
      message: message ?? nonEmptyString(detail.message),
      code: nonEmptyString(detail.code),
    };
  }

  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    return {
      message: message ?? (isRecord(first) ? nonEmptyString(first.msg) : null),
      code: null,
    };
  }

  return { message, code: null };
};
