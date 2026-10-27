// Разделы в шапке защищённой зоны и правило, какой из них сейчас открыт.

import type { MyClinicRead } from '@/api';

export type AppNavItemId = 'registry' | 'questionnaires' | 'protocols';

export interface AppNavItem {
  id: AppNavItemId;
  label: string;
  href: string;
}

const REGISTRY_ITEM: AppNavItem = {
  id: 'registry',
  label: 'Анкеты пациентов',
  href: '/registry',
};

/** Порядок — как на макете. */
export const NAV_ITEMS: AppNavItem[] = [
  { id: 'questionnaires', label: 'Анкеты', href: '/questionnaires' },
  { id: 'protocols', label: 'Протоколы', href: '/' },
];

/**
 * Регистратура — администратор клиники со стоматологической анкетой: он
 * создаёт пациентам персональные ссылки и печатает анкеты.
 */
export const canUseRegistry = (
  clinic: Pick<MyClinicRead, 'is_clinic_admin' | 'questionnaire_kind'> | null,
): boolean => clinic?.is_clinic_admin === true && clinic.questionnaire_kind === 'dental';

/** Разделы шапки; «Анкеты пациентов» — первым, это рабочий экран регистратуры. */
export const getNavItems = ({ showRegistry }: { showRegistry: boolean }): AppNavItem[] =>
  showRegistry ? [REGISTRY_ITEM, ...NAV_ITEMS] : NAV_ITEMS;

const isSection = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(`${base}/`);

/**
 * Какой раздел открыт.
 *
 * Сравнение идёт по сегменту пути, а не через голый `startsWith`: иначе
 * `/questionnairesX` считался бы разделом анкет. Параметры запроса в путь не
 * входят — экран протокола `/?id=…` это просто `/`.
 */
export const getActiveNavItem = (pathname: string): AppNavItemId | null => {
  if (pathname === '/') return 'protocols';
  if (isSection(pathname, '/questionnaires')) return 'questionnaires';
  if (isSection(pathname, '/registry')) return 'registry';
  return null;
};
