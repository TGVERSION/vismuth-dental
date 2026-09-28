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
import {
  MEMBER_ROLE_OPTIONS,
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

const ROLE_COLOR: Record<MemberRole, string> = {
  admin: 'text-[#E4478C]',
  doctor: 'text-[#3AA0E0]',
};

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
  const roles = memberFlagsToRoles(member);

  return (
    <li
      className={`rounded-xl px-3.75 py-3 transition-all ${
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
            className={`mt-1.5 shrink-0 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
          <span className="min-w-0">
            <span className="block truncate text-base text-[#202020]">
              {name}
            </span>
            <span className="mt-0.5 block text-sm">
              {isInvited ? (
                <span className="text-[#A0A7B0]">Приглашение отправлено</span>
              ) : (
                roles.map((role, index) => (
                  <span key={role}>
                    {index > 0 && <span className="text-[#202020]">, </span>}
                    <span className={ROLE_COLOR[role]}>
                      {MEMBER_ROLE_OPTIONS.find((o) => o.value === role)?.label}
                    </span>
                  </span>
                ))
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

  const roleOptions = MEMBER_ROLE_OPTIONS.map((option) => ({
    ...option,
    disabled: option.value === 'doctor' && !member.is_doctor && !canAddDoctor,
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
        label="Роль сотрудника"
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
        <CustomDropdown<MemberRole, true>
          multiple
          options={roleOptions}
          value={currentRoles}
          onChange={changeRoles}
          triggerClassName={fieldFillClass(currentRoles)}
          aria-label="Роль сотрудника"
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
            pendingRoles ? 'rounded-lg ring-2 ring-[#F2B84B]' : undefined
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

  const roleLabels = memberFlagsToRoles(member)
    .map((role) => MEMBER_ROLE_OPTIONS.find((o) => o.value === role)?.label)
    .join(', ');

  return (
    <>
      <FieldRow label="Роль сотрудника" htmlFor={`${baseId}-role`}>
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
          <p role="alert" className="mt-1 text-xs text-[#E53E3E]">
            {error}
          </p>
        )}
      </div>
    </>
  );
};
