// Какие маршруты доступны без авторизации.
//
// Новый публичный маршрут добавляется сюда одновременно с созданием страницы
// в src/app/(public).

/** Маршруты с фиксированным адресом. */
export const PUBLIC_ROUTES = ['/login', '/register', '/verify'];

/**
 * Разделы, публичные целиком. Адрес анкеты пациента содержит случайный код
 * (`/q/AbC123`), поэтому точным сравнением его не покрыть. `/invite` —
 * принятие приглашения сотрудником: аккаунта у него ещё нет.
 */
export const PUBLIC_ROUTE_PREFIXES = ['/q', '/invite'];

/**
 * Публичный ли путь.
 *
 * Префикс сравнивается **по сегменту**, а не через голый `startsWith`:
 * `startsWith('/q')` открыл бы наружу и `/quotes`, и `/qa`, то есть любой
 * будущий маршрут, начинающийся с тех же букв. Цена ошибки здесь — доступ
 * к экрану протокола без авторизации.
 */
export const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
};
