/** Проверяет и кодированные варианты внутреннего пути до общего ML proxy. */
export function isBlockedInternalMlPath(pathname: string): boolean {
  let decoded = pathname;
  for (let index = 0; index < 8; index++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return false;
    }
    if (next === decoded) {
      const normalized = new URL(decoded, 'http://internal.invalid').pathname
        .replace(/\/+/g, '/')
        .toLowerCase();
      const prefix = '/api/ml/questionnaire_answer_guard';
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    }
    decoded = next;
  }
  // Многократное кодирование не нужно публичным ML-маршрутам.
  return true;
}
