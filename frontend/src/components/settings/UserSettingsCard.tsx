'use client';

import { useId, useState } from 'react';
import type { RoleName, ServiceUserIdRead } from '@/api';
import type {
  MembershipRoleOption,
  UserMembershipRead,
} from '@/api/user-membership-api';
import { canDeleteUser } from '@/lib/roles';
import { canEditMembership, userDisplayName } from '@/lib/user-membership';
import { UserClinicMembershipEditor } from './UserClinicMembershipEditor';
import { UserSettingsField } from './UserSettingsField';

export type SettingsUser = ServiceUserIdRead &
  Partial<UserMembershipRead> & {
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
  };

interface Props {
  user: SettingsUser;
  actorId?: string;
  actorRole?: RoleName;
  membershipRoles: MembershipRoleOption[];
  pending: boolean;
  canManageClinics: boolean;
  onMembershipSaved: (user: UserMembershipRead) => void;
  onDelete: (userId: string) => void;
}

export function UserSettingsCard({
  user,
  actorId,
  actorRole,
  membershipRoles,
  pending,
  canManageClinics,
  onMembershipSaved,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [membershipSaving, setMembershipSaving] = useState(false);
  const contentId = useId();
  const actions = { actorId, actorRole, targetId: user.id };
  const displayName = userDisplayName(user);
  const roleLabel =
    user.role === 'super_admin'
      ? 'Супер-админ'
      : membershipRoles.find(
          (role) =>
            role.value ===
            (user.clinic_role ??
              (user.role === 'admin' ? 'clinic_admin' : 'doctor')),
        )?.label;
  const canManageMembership =
    actorRole &&
    canEditMembership(actorRole, user.role) &&
    user.specialization_ids !== undefined;

  return (
    <section
      aria-label={`Пользователь ${user.login}`}
      className="min-w-0 rounded-2xl bg-white shadow-[var(--ui-shadow)]"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          disabled={membershipSaving}
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left disabled:cursor-wait"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            aria-hidden="true"
            className={`mt-1 shrink-0 text-[var(--ui-color-alabaster-950)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path
              d="m3 5 4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="min-w-0">
            <span className="block break-words text-sm text-[var(--ui-color-alabaster-dark-800)]">
              {displayName}
            </span>
            {displayName !== user.login && (
              <span className="mt-1 block break-all text-xs text-[var(--ui-color-alabaster-950)]">
                {user.login}
              </span>
            )}
            {canManageClinics && (
              <span className="mt-1 block break-words text-xs text-[var(--ui-color-alabaster-950)]">
                {user.clinic_name ?? 'Без клиники'}
                {roleLabel ? ` · ${roleLabel}` : ''}
              </span>
            )}
          </span>
        </button>
        {user.is_active !== undefined && (
          <span
            className="mt-1 flex shrink-0 items-center gap-[var(--ui-space-6)] text-xs text-[var(--ui-color-alabaster-950)]"
            title="Статус учётной записи"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-[var(--ui-color-green-600)]' : 'bg-[var(--ui-color-alabaster-700)]'}`}
            />
            {user.is_active ? 'Активен' : 'Отключён'}
          </span>
        )}
      </div>
      {expanded && (
        <div
          id={contentId}
          className="flex min-w-0 flex-col gap-5 px-4 pb-5 pt-2 sm:px-5"
        >
          <UserSettingsField
            label="Электронная почта"
            hint="Адрес для входа в учётную запись"
          >
            <p className="vismuth-input break-all">{user.login}</p>
          </UserSettingsField>
          {canManageClinics &&
            (canManageMembership ? (
              <UserClinicMembershipEditor
                user={user as UserMembershipRead}
                roles={membershipRoles}
                disabled={pending}
                onSaved={onMembershipSaved}
                onClose={() => setExpanded(false)}
                onSavingChange={setMembershipSaving}
              />
            ) : (
              <UserSettingsField
                label="Клиника"
                hint={
                  user.role === 'super_admin'
                    ? 'Супер-администратор работает со всеми клиниками без собственного членства'
                    : 'Роль сотрудника изменяет супер-администратор'
                }
              >
                <p className="break-words rounded-xl bg-[var(--ui-color-alabaster-500)] px-4 py-3 text-sm text-[var(--ui-color-alabaster-950)]">
                  {user.clinic_name ?? 'Не назначена'}
                </p>
              </UserSettingsField>
            ))}
          {!canManageMembership && (
            <UserSettingsField label="Роль">
              <p className="vismuth-input">{roleLabel ?? user.role_name_ru}</p>
            </UserSettingsField>
          )}
          {canDeleteUser(actions) && (
            <div className="flex justify-end border-t border-[var(--ui-color-slate-100)] pt-4">
              <button
                type="button"
                disabled={pending || membershipSaving}
                onClick={() => onDelete(user.id)}
                className="cursor-pointer text-sm text-[var(--ui-color-red-600)] disabled:opacity-50"
              >
                Удалить пользователя
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
