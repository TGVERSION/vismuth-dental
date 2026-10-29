// Какие заглушки backend включены в сборку.
//
// В разработке по умолчанию включены все. В production-сборке — только
// перечисленные в переменной MOCKS при сборке образа: так демо-контур
// показывает разделы, для которых у backend ещё нет эндпоинтов. На сервере с
// настоящими врачами и пациентами MOCKS не задаётся: заглушки подменяют
// backend выдуманными данными.
//
// Список вычисляется в `next.config.ts` и вшивается в сборку переменной
// VISMUTH_MOCKS (`env` в конфиге): правила перенаправления и проверки в
// маршрутах заглушек всегда согласованы, а поменять набор можно только
// пересборкой.
//
// Модуль импортирует `next.config.ts`, поэтому здесь нельзя пользоваться
// алиасом `@/` и зависимостями Next.

export const MOCK_NAMES = [
  // Распознавание приёма: /api/main/speech/*.
  'speech',
  // Публичная анкета пациента: /api/main/public/* (весь публичный роутер
  // backend — сейчас это только анкета).
  'questionnaire',
  // Анкеты у врача: /api/main/questionnaires*.
  'doctor-questionnaires',
] as const;

export type MockName = (typeof MOCK_NAMES)[number];

const isMockName = (value: string): value is MockName =>
  (MOCK_NAMES as readonly string[]).includes(value);

export interface ParsedMocks {
  enabled: MockName[];
  /** Имена, которых нет среди заглушек, — скорее всего опечатка. */
  unknown: string[];
}

/**
 * Разбор MOCKS: имена через запятую или `all`. Пробелы и регистр не важны,
 * пустая строка — ни одной заглушки.
 */
export const parseMocks = (raw: string): ParsedMocks => {
  const items = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (items.includes('all')) {
    return {
      enabled: [...MOCK_NAMES],
      unknown: items.filter((item) => item !== 'all' && !isMockName(item)),
    };
  }

  return {
    enabled: MOCK_NAMES.filter((name) => items.includes(name)),
    unknown: items.filter((item) => !isMockName(item)),
  };
};

/** Включена ли заглушка в эту сборку. */
export const isBuiltWithMock = (name: MockName): boolean =>
  (process.env.VISMUTH_MOCKS ?? '').split(',').includes(name);
