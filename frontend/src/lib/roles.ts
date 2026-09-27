
import type { RoleName, RoleRead } from '@/api';

/**
 * Роли с правом управлять пользователями. Это правило доступа — зеркало
 * `PRIVILEGED_ROLE_NAMES` в backend, а не справочник для отображения.
 */
export const PRIVILEGED_ROLES: readonly RoleName[] = ['super_admin', 'admin'];

/**
 * Роли, которые не предлагаются при смене роли сотрудника: учётки пациентов
 * в сервисе нет, анкета пациента публичная.
 */
const HIDDEN_ROLE_OPTIONS: readonly RoleName[] = ['patient'];

/**
 * Привилегированная ли роль.
 *
 * Принимает любую строку: в `localStorage` может лежать пользователь,
 * сохранённый до миграции (`administrator`, `head_of_department`). Такие коды
 * не считаются привилегированными — роль освежается с сервера при входе
 * в защищённую зону.
 */
export const isPrivilegedRole = (role: string | null | undefined): boolean =>
  !!role && (PRIVILEGED_ROLES as readonly string[]).includes(role);

/** Опция выпадающего списка. Совместима с `DropdownOption<string>`. */
export interface RoleOption {
  value: string;
  label: string;
}

export interface RoleTarget {
  role: string;
  role_name_ru?: string;
}

/**
 * Опции выпадающего списка роли для строки пользователя.
 *
 * Порядок — как в справочнике с сервера. Скрытые роли показываются, только
 * если это текущая роль пользователя. Если текущей роли в опциях нет
 * (справочник не загрузился, неизвестный код), она добавляется с подписью
 * из `role_name_ru` — иначе список показал бы «Выберите...».
 */
export const buildRoleOptions = (
  roles: RoleRead[],
  target: RoleTarget,
): RoleOption[] => {
  const options: RoleOption[] = roles
    .filter(
      (role) =>
        !HIDDEN_ROLE_OPTIONS.includes(role.name) || role.name === target.role,
    )
    .map((role) => ({ value: role.name, label: role.name_ru }));

  if (!options.some((option) => option.value === target.role)) {
    options.push({
      value: target.role,
      label: target.role_name_ru || target.role,
    });
  }

  return options;
};

export interface UserActionParams {
  actorId: string | null | undefined;
  actorRole: string | null | undefined;
  targetId: string;
}

/**
 * Можно ли сменить роль пользователю.
 *
 * Свою строку менять нельзя: так админ не снимет права сам с себя случайным
 * кликом (backend этого не запрещает). Если `id` текущего пользователя
 * неизвестен, свою строку не распознать — тогда запрещено всё.
 */
export const canEditUserRole = ({
  actorId,
  actorRole,
  targetId,
}: UserActionParams): boolean => {
  if (!actorId) return false;
  if (actorId === targetId) return false;

  return isPrivilegedRole(actorRole);
};

/** Можно ли удалить пользователя. Правила те же, что для смены роли. */
export const canDeleteUser = (params: UserActionParams): boolean =>
  canEditUserRole(params);
