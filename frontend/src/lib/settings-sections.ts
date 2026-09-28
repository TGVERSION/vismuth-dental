// Разделы окна настроек и правило, какой из них открыт.

export type SettingsSection = 'clinics' | 'users' | 'protocols' | 'directories';

export interface SettingsSectionItem {
  id: SettingsSection;
  label: string;
}

/** Какие закрытые разделы доступны текущему пользователю. */
export interface SettingsAccess {
  canManageClinics: boolean;
  canManageUsers: boolean;
}

const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  { id: 'clinics', label: 'Клиники' },
  { id: 'users', label: 'Пользователи' },
  { id: 'protocols', label: 'Структуры протоколов' },
  { id: 'directories', label: 'Справочники' },
];

const isAvailable = (
  section: SettingsSection,
  access: SettingsAccess,
): boolean => {
  if (section === 'clinics') return access.canManageClinics;
  if (section === 'users') return access.canManageUsers;
  return true;
};

/** Пункты меню, доступные пользователю, в порядке макета. */
export const getSettingsSections = (
  access: SettingsAccess,
): SettingsSectionItem[] =>
  SETTINGS_SECTIONS.filter((section) => isAvailable(section.id, access));

export const getSettingsSectionLabel = (section: SettingsSection): string =>
  SETTINGS_SECTIONS.find((item) => item.id === section)?.label ?? '';

/**
 * Какой раздел показать.
 *
 * `selected` — выбор пользователя, `null` — ещё ничего не выбрано: тогда
 * открывается первый доступный раздел. Раздел вычисляется при каждом
 * рендере, а не хранится: окно смонтировано заранее, и роль может освежиться
 * с сервера уже после монтирования.
 */
export const resolveSettingsSection = (
  selected: SettingsSection | null,
  access: SettingsAccess,
): SettingsSection => {
  if (selected !== null && isAvailable(selected, access)) return selected;

  return getSettingsSections(access)[0].id;
};
