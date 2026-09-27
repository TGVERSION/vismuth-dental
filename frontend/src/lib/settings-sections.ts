// Разделы окна настроек и правило, какой из них открыт.

export type SettingsSection = 'users' | 'protocols' | 'directories';

export interface SettingsSectionItem {
  id: SettingsSection;
  label: string;
}

const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  { id: 'users', label: 'Пользователи' },
  { id: 'protocols', label: 'Структуры протоколов' },
  { id: 'directories', label: 'Справочники' },
];

/** Пункты меню. «Пользователи» — только тем, кто может ими управлять. */
export const getSettingsSections = (
  canManageUsers: boolean,
): SettingsSectionItem[] =>
  canManageUsers
    ? SETTINGS_SECTIONS
    : SETTINGS_SECTIONS.filter((section) => section.id !== 'users');

export const getSettingsSectionLabel = (section: SettingsSection): string =>
  SETTINGS_SECTIONS.find((item) => item.id === section)?.label ?? '';

/**
 * Какой раздел показать.
 *
 * `selected` — выбор пользователя, `null` — ещё ничего не выбрано. Раздел
 * вычисляется при каждом рендере, а не хранится: окно смонтировано заранее,
 * и роль может освежиться с сервера уже после монтирования.
 */
export const resolveSettingsSection = (
  selected: SettingsSection | null,
  canManageUsers: boolean,
): SettingsSection => {
  if (selected === null) return canManageUsers ? 'users' : 'protocols';
  if (selected === 'users' && !canManageUsers) return 'protocols';

  return selected;
};
