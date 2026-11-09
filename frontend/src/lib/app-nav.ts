// Разделы в шапке защищённой зоны и правило, какой из них сейчас открыт.

import type { MyClinicRead } from '@/api';

export type AppNavItemId =
  | 'registry'
  | 'questionnaires'
  | 'protocols'
  | 'completed'
  | 'requests';

export interface AppNavItem {
  id: AppNavItemId;
  label: string;
  href: string;
}

const REGISTRY_ITEM: AppNavItem = {
  id: 'registry',
  label: 'Анкеты для стоматологии',
  href: '/registry',
};

/** Порядок — как на макете. */
export const NAV_ITEMS: AppNavItem[] = [
  { id: 'questionnaires', label: 'Анкеты для врачей', href: '/questionnaires' },
  { id: 'protocols', label: 'Протоколы', href: '/' },
];

/**
 * Регистратура — администратор клиники со стоматологической анкетой: он
 * создаёт пациентам персональные ссылки и печатает анкеты.
 */
export const canUseRegistry = (
  clinic:
    | (Pick<MyClinicRead, 'is_clinic_admin' | 'questionnaire_kind'> & {
        is_operator?: boolean;
      })
    | null,
): boolean =>
  (clinic?.is_clinic_admin === true || clinic?.is_operator === true) &&
  (clinic.questionnaire_kind === 'dental' ||
    clinic.questionnaire_kind === 'mixed');

/** Стоматология — первой; врачебные инструменты зависят от членства. */
export const getNavItems = ({
  showRegistry,
  role,
  isDoctor = false,
}: {
  showRegistry: boolean;
  role?: string | null;
  isDoctor?: boolean;
}): AppNavItem[] => {
  if (role === 'super_admin')
    return [
      REGISTRY_ITEM,
      {
        ...NAV_ITEMS[0],
        id: 'completed',
        href: '/completed-questionnaires',
      },
      { id: 'protocols', label: 'Протоколы', href: '/' },
      { id: 'requests', label: 'Заявки', href: '/join-requests' },
    ];
  const items = NAV_ITEMS.filter((item) => item.id !== 'protocols' || isDoctor);
  return showRegistry ? [REGISTRY_ITEM, ...items] : items;
};

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
  if (isSection(pathname, '/completed-questionnaires')) return 'completed';
  if (isSection(pathname, '/join-requests')) return 'requests';
  if (isSection(pathname, '/questionnaires')) return 'questionnaires';
  if (isSection(pathname, '/registry')) return 'registry';
  return null;
};
