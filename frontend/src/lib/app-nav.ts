// Разделы в шапке защищённой зоны и правило, какой из них сейчас открыт.

export type AppNavItemId = 'questionnaires' | 'protocols';

export interface AppNavItem {
  id: AppNavItemId;
  label: string;
  href: string;
}

/** Порядок — как на макете. */
export const NAV_ITEMS: AppNavItem[] = [
  { id: 'questionnaires', label: 'Анкеты', href: '/questionnaires' },
  { id: 'protocols', label: 'Протоколы', href: '/' },
];

/**
 * Какой раздел открыт.
 *
 * Сравнение идёт по сегменту пути, а не через голый `startsWith`: иначе
 * `/questionnairesX` считался бы разделом анкет. Параметры запроса в путь не
 * входят — экран протокола `/?id=…` это просто `/`.
 */
export const getActiveNavItem = (pathname: string): AppNavItemId | null => {
  if (pathname === '/') return 'protocols';

  if (
    pathname === '/questionnaires' ||
    pathname.startsWith('/questionnaires/')
  ) {
    return 'questionnaires';
  }

  return null;
};
