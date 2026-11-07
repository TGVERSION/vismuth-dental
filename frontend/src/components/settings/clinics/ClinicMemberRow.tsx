'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import { toast } from 'react-toastify';
import type {
  ClinicInvitationCreated,
  ClinicMemberPatch,
  ClinicMemberRead,
  SpecializationRead,
} from '@/api';
import { CustomDropdown } from '@/components/CustomDropdown';
import { useStaffRoles } from '@/hooks/useStaffRoles';
import { staffRole, roleFromValues, memberRoleValues } from '@/lib/staff-role';
import type { MembershipRole } from '@/api/user-membership-api';
import {
  buildMemberRolesPatch,
  filterOptions,
  formatMemberName,
  isValidImageUrl,
  memberFlagsToRoles,
  parseFullName,
  type MemberRole,
} from '@/lib/clinics';
import type { InviteResult } from '@/hooks/useClinicMembers';
import { fieldFillClass } from '@/lib/field-fill';
import { FieldRow, INPUT_CLASS, LINK_BUTTON_CLASS } from './fields';
import { InviteLinkResult } from './InviteLinkResult';

interface ClinicMemberRowProps {
  member: ClinicMemberRead;
  canAddDoctor: boolean;
  specializations: SpecializationRead[];
  onPatch: (data: ClinicMemberPatch) => Promise<boolean>;
  onDeactivate: () => void;
  onResend: () => Promise<InviteResult>;
}

export const ClinicMemberRow = ({
  member,
  canAddDoctor,
  specializations,
  onPatch,
  onDeactivate,
  onResend,
}: ClinicMemberRowProps) => {
  const baseId = useId();
  const [expanded, setExpanded] = useState(false);
  const isInvited = member.kind === 'invitation';
  const name = formatMemberName(member);
  const roleLabel = useStaffRoles().find(
    (option) => option.value === staffRole(member),
  )?.label;

  return (
    <li
      className={`rounded-xl px-[var(--ui-space-14)] py-3 transition-all ${
        expanded ? 'bg-white shadow-custom' : 'shadow-custom-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={`${baseId}-details`}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
        >
          <Image
            src="/arrow-dropdown.svg"
            alt=""
            width={12}
            height={12}
            className={`mt-[var(--ui-space-6)] shrink-0 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
          <span className="min-w-0">
            <span className="block truncate text-base text-[var(--ui-color-alabaster-dark-800)]">
              {name}
            </span>
            <span className="mt-[var(--ui-space-2)] block text-sm">
              {isInvited ? (
                <span className="text-[var(--ui-color-alabaster-800)]">
                  Приглашение отправлено
                </span>
              ) : (
                <span className="text-[var(--ui-color-blue-600)]">
                  {roleLabel}
                </span>
              )}
            </span>
          </span>
        </button>

        {!isInvited && (
          <button
            type="button"
            onClick={onDeactivate}
            aria-label={`Удалить сотрудника ${name}`}
            className="mt-1 shrink-0 cursor-pointer"
          >
            <Image
              src="/delete-gray.svg"
              alt=""
              width={18}
              height={18}
              className="icon-gray"
            />
          </button>
        )}
      </div>

      {expanded && (
        <div id={`${baseId}-details`} className="mt-2 pl-6">
          {isInvited ? (
            <InvitedDetails
              member={member}
              baseId={baseId}
              onResend={onResend}
            />
          ) : (
            <ActiveDetails
              member={member}
              baseId={baseId}
              canAddDoctor={canAddDoctor}
              specializations={specializations}
              onPatch={onPatch}
            />
          )}
        </div>
      )}
    </li>
  );
};

interface ActiveDetailsProps {
  member: ClinicMemberRead;
  baseId: string;
  canAddDoctor: boolean;
  specializations: SpecializationRead[];
  onPatch: (data: ClinicMemberPatch) => Promise<boolean>;
}

const ActiveDetails = ({
  member,
  baseId,
  canAddDoctor,
  specializations,
  onPatch,
}: ActiveDetailsProps) => {
  const [fullName, setFullName] = useState(() =>
    [member.last_name, member.first_name, member.middle_name]
      .filter(Boolean)
      .join(' '),
  );
  const [photoUrl, setPhotoUrl] = useState(member.photo_url ?? '');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  // Роли, ждущие выбора специализации: «Врач» уходит только вместе с ней.
  const [pendingRoles, setPendingRoles] = useState<MemberRole[] | null>(null);
  const [specQuery, setSpecQuery] = useState('');

  const currentRoles = pendingRoles ?? memberFlagsToRoles(member);
  const specIds = member.specializations.map((spec) => spec.id);

  const save = async (key: string, data: ClinicMemberPatch) => {
    const ok = await onPatch(data);
    setErrors((prev) => ({ ...prev, [key]: ok ? null : 'Не сохранено' }));
    return ok;
  };

  const commitName = () => {
    const parsed = parseFullName(fullName);
    if (
      parsed.last_name === member.last_name &&
      parsed.first_name === member.first_name &&
      parsed.middle_name === member.middle_name
    ) {
      return;
    }
    void save('name', parsed);
  };

  const commitPhoto = () => {
    const value = photoUrl.trim();
    if (!isValidImageUrl(value)) {
      setErrors((prev) => ({
        ...prev,
        photo: 'Ссылка вида https://… или /путь/к/файлу.png',
      }));
      return;
    }
    if ((value || null) === member.photo_url) {
      setErrors((prev) => ({ ...prev, photo: null }));
      return;
    }
    void save('photo', { photo_url: value || null });
  };

  const changeRoles = async (roles: MemberRole[]) => {
    const change = buildMemberRolesPatch(member, roles, specIds);

    switch (change.kind) {
      case 'no_roles':
        toast.info('У сотрудника должна остаться хотя бы одна роль');
        return;
      case 'unchanged':
        setPendingRoles(null);
        return;
      case 'needs_specialization':
        setPendingRoles(roles);
        return;
      case 'patch':
        setPendingRoles(null);
        await save('roles', change.data);
    }
  };

  const changeSpecializations = async (ids: number[]) => {
    if (pendingRoles) {
      const change = buildMemberRolesPatch(member, pendingRoles, ids);
      if (change.kind === 'patch') {
        const ok = await save('roles', change.data);
        if (ok) setPendingRoles(null);
      }
      return;
    }
    if (member.is_doctor && ids.length === 0) {
      toast.info('У врача должна быть хотя бы одна специализация');
      return;
    }
    await save('specs', { specialization_ids: ids });
  };

  const roleOptions = useStaffRoles().map((option) => ({
    ...option,
    disabled:
      (option.value === 'doctor' || option.value === 'clinic_admin_doctor') &&
      !member.is_doctor &&
      !canAddDoctor,
  }));

  const specOptions = filterOptions(
    specializations.map((spec) => ({ value: spec.id, label: spec.name })),
    specQuery,
    specIds,
  );

  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  return (
    <>
      <FieldRow
        label="ФИО сотрудника"
        hint="Как зовут сотрудника для выбора пациентом"
        htmlFor={`${baseId}-name`}
        error={errors.name}
      >
        <input
          id={`${baseId}-name`}
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          onBlur={commitName}
          onKeyDown={blurOnEnter}
          placeholder="Фамилия Имя Отчество"
          className={`${INPUT_CLASS} ${fieldFillClass(fullName)}`}
        />
      </FieldRow>

      <FieldRow
        label="Роль"
        hint="Какие права доступны сотруднику на сервисе"
        error={errors.roles}
        note={
          !member.is_doctor && !canAddDoctor
            ? 'Достигнут лимит врачей'
            : pendingRoles
              ? 'Выберите специализацию, чтобы сохранить роль «Врач»'
              : null
        }
      >
        <CustomDropdown<MembershipRole>
          options={roleOptions}
          value={roleFromValues(currentRoles)}
          onChange={(role) => void changeRoles(memberRoleValues(role))}
          triggerClassName={fieldFillClass(currentRoles)}
          aria-label="Роль"
        />
      </FieldRow>

      <FieldRow
        label="Почта"
        hint="Почта сотрудника на сервисе"
        htmlFor={`${baseId}-email`}
      >
        <input
          id={`${baseId}-email`}
          type="email"
          value={member.email ?? ''}
          readOnly
          disabled
          className={`${INPUT_CLASS} ${fieldFillClass(member.email)}`}
        />
      </FieldRow>

      <FieldRow
        label="Фото"
        hint="Ссылка на .png или .jpg с фотографией сотрудника"
        htmlFor={`${baseId}-photo`}
        error={errors.photo}
      >
        <input
          id={`${baseId}-photo`}
          type="url"
          value={photoUrl}
          onChange={(event) => setPhotoUrl(event.target.value)}
          onBlur={commitPhoto}
          onKeyDown={blurOnEnter}
          placeholder="https://…"
          className={`${INPUT_CLASS} ${fieldFillClass(photoUrl)}`}
        />
      </FieldRow>

      <FieldRow
        label="Специализация"
        hint="Профиль работы сотрудника"
        error={errors.specs}
      >
        <div
          className={
            pendingRoles
              ? 'rounded-lg ring-2 ring-[var(--ui-color-yellow-300)]'
              : undefined
          }
        >
          <CustomDropdown<number, true>
            multiple
            options={specOptions}
            value={specIds}
            onChange={changeSpecializations}
            triggerClassName={fieldFillClass(specIds)}
            onSearch={setSpecQuery}
            placeholder="Не выбрана"
            aria-label="Специализация"
          />
        </div>
      </FieldRow>
    </>
  );
};

interface InvitedDetailsProps {
  member: ClinicMemberRead;
  baseId: string;
  onResend: () => Promise<InviteResult>;
}

/** Приглашение до принятия: только чтение и повторная отправка. */
const InvitedDetails = ({ member, baseId, onResend }: InvitedDetailsProps) => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ClinicInvitationCreated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setSending(true);
    setError(null);
    const response = await onResend();
    setSending(false);
    if (response.ok) setResult(response.invitation);
    else setError(response.message);
  };

  const roleLabels =
    useStaffRoles().find((option) => option.value === staffRole(member))
      ?.label ?? '';

  return (
    <>
      <FieldRow label="Роль" htmlFor={`${baseId}-role`}>
        <input
          id={`${baseId}-role`}
          value={roleLabels}
          readOnly
          disabled
          className={`${INPUT_CLASS} ${fieldFillClass(roleLabels)}`}
        />
      </FieldRow>
      <FieldRow label="Почта" htmlFor={`${baseId}-email`}>
        <input
          id={`${baseId}-email`}
          value={member.email ?? ''}
          readOnly
          disabled
          className={`${INPUT_CLASS} ${fieldFillClass(member.email)}`}
        />
      </FieldRow>
      {member.specializations.length > 0 && (
        <FieldRow label="Специализация" htmlFor={`${baseId}-spec`}>
          <input
            id={`${baseId}-spec`}
            value={member.specializations.map((spec) => spec.name).join(', ')}
            readOnly
            disabled
            className={`${INPUT_CLASS} ${fieldFillClass(member.specializations)}`}
          />
        </FieldRow>
      )}

      <div className="py-3">
        {result ? (
          <InviteLinkResult invitation={result} />
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className={LINK_BUTTON_CLASS}
          >
            {sending ? 'Отправляем…' : 'Отправить повторно'}
          </button>
        )}
        {error && (
          <p
            role="alert"
            className="mt-1 text-xs text-[var(--ui-color-red-600)]"
          >
            {error}
          </p>
        )}
      </div>
    </>
  );
};
