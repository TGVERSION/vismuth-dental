// Логирование, безопасное для медицинского контура.
//
// Тела ошибок с бэкенда содержат фрагменты протоколов, идентификаторы
// пациентов и текст, отправленный в ML. В консоли браузера врача этому
// места нет, поэтому в production наружу идёт только контекст ошибки —
// человекочитаемая метка места, без данных.
//
// В разработке выводим всё: там это и нужно для отладки.

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Сообщить об ошибке. `context` — короткая метка места («Ошибка сохранения
 * протокола»), `error` попадает в консоль только в dev-сборке.
 */
export function logError(context: string, error?: unknown): void {
  if (isDev) {
    console.error(context, error);
    return;
  }
  console.error(context);
}

/**
 * Предупреждение. Дополнительные данные, как и в logError, показываются
 * только в разработке.
 */
export function logWarn(context: string, details?: unknown): void {
  if (isDev) {
    console.warn(context, details);
    return;
  }
  console.warn(context);
}
