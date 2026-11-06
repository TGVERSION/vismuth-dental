'use client';

import { useId, useState } from 'react';
import type { RoleName, RoleRead, ServiceUserIdRead } from '@/api';
import type {
  MembershipRoleOption,
  UserMembershipRead,
} from '@/api/user-membership-api';
import { buildRoleOptions, canDeleteUser, canEditUserRole } from '@/lib/roles';
import { canEditMembership, userDisplayName } from '@/lib/user-membership';
import { CustomDropdown } from '../CustomDropdown';
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
  roles: RoleRead[];
  membershipRoles: MembershipRoleOption[];
  rolesFailed: boolean;
  pending: boolean;
  canManageClinics: boolean;
  onRoleChange: (userId: string, role: string) => void;
  onMembershipSaved: (user: UserMembershipRead) => void;
  onDelete: (userId: string) => void;
}

export function UserSettingsCard({
  user,
  actorId,
  actorRole,
  roles,
  membershipRoles,
  rolesFailed,
  pending,
  canManageClinics,
  onRoleChange,
  onMembershipSaved,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [membershipSaving, setMembershipSaving] = useState(false);
  const contentId = useId();
  const actions = { actorId, actorRole, targetId: user.id };
  const displayName = userDisplayName(user);
  const roleLabel = membershipRoles.find(
    (role) => role.value === user.clinic_role,
  )?.label;
  const canManageMembership =
    actorRole &&
    canEditMembership(actorRole, user.role) &&
    user.specialization_ids !== undefined;

  return (
    <section
      aria-label={`Пользователь ${user.login}`}
      className="min-w-0 rounded-2xl bg-white shadow-[0_3px_24px_rgba(32,32,32,0.035)]"
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
            className={`mt-1 shrink-0 text-[#8B8B8B] transition-transform ${expanded ? 'rotate-180' : ''}`}
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
            <span className="block break-words text-sm text-[#202020]">
              {displayName}
            </span>
            {displayName !== user.login && (
              <span className="mt-1 block break-all text-xs text-[#8B8B8B]">
                {user.login}
              </span>
            )}
            {canManageClinics && (
              <span className="mt-1 block break-words text-xs text-[#8B8B8B]">
                {user.clinic_name ?? 'Без клиники'}
                {roleLabel ? ` · ${roleLabel}` : ''}
              </span>
            )}
          </span>
        </button>
        {user.is_active !== undefined && (
          <span
            className="mt-1 flex shrink-0 items-center gap-1.5 text-xs text-[#6C757D]"
            title="Статус учётной записи"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-[#7CAC8E]' : 'bg-[#B8BEC7]'}`}
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
            <p className="break-all rounded-xl bg-[#F1F1F1] px-4 py-3 text-sm text-[#6C757D]">
              {user.login}
            </p>
          </UserSettingsField>
          <UserSettingsField
            label="Роль в системе"
            hint="Общие права пользователя в сервисе"
          >
            <CustomDropdown
              options={buildRoleOptions(roles, user)}
              value={user.role}
              onChange={(value) => onRoleChange(user.id, value)}
              disabled={
                !canEditUserRole(actions) ||
                rolesFailed ||
                pending ||
                membershipSaving
              }
              aria-label={`Роль в системе ${user.login}`}
              triggerClassName="bg-[#E3E8F1]"
            />
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
                    : 'Для назначения клиники сначала выберите врачебную роль в системе'
                }
              >
                <p className="break-words rounded-xl bg-[#F1F1F1] px-4 py-3 text-sm text-[#6C757D]">
                  {user.clinic_name ?? 'Не назначена'}
                </p>
              </UserSettingsField>
            ))}
          {canDeleteUser(actions) && (
            <div className="flex justify-end border-t border-[#F1F2F4] pt-4">
              <button
                type="button"
                disabled={pending || membershipSaving}
                onClick={() => onDelete(user.id)}
                className="cursor-pointer text-sm text-[#C86464] disabled:opacity-50"
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
