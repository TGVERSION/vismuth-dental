'use client';

import { useEffect, useRef, useState } from 'react';
import { mainApi, type ClinicRead, type SpecializationRead } from '@/api';
import {
  userMembershipApi,
  type MembershipRole,
  type MembershipRoleOption,
  type UserMembershipRead,
} from '@/api/user-membership-api';
import {
  buildMembershipUpdate,
  membershipHasChanges,
} from '@/lib/user-membership';
import { CustomDropdown } from '../CustomDropdown';
import { UserSettingsField } from './UserSettingsField';

interface Props {
  user: UserMembershipRead;
  roles: MembershipRoleOption[];
  disabled?: boolean;
  onSaved: (user: UserMembershipRead) => void;
  onSavingChange?: (saving: boolean) => void;
}

export function UserClinicMembershipEditor({
  user,
  roles,
  disabled = false,
  onSaved,
  onSavingChange,
}: Props) {
  const [clinicId, setClinicId] = useState(user.clinic_id ?? '');
  const [role, setRole] = useState<MembershipRole | null>(
    user.clinic_role ?? (user.role === 'admin' ? 'clinic_admin' : 'doctor'),
  );
  const [specializationIds, setSpecializationIds] = useState(
    user.specialization_ids,
  );
  const [clinics, setClinics] = useState<ClinicRead[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationRead[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const doctor = role === 'doctor' || role === 'clinic_admin_doctor';
  const payload = buildMembershipUpdate(clinicId, role, specializationIds);
  const changed = membershipHasChanges(user, payload);
  const blocked = disabled || saving || loading || loadFailed || !roles.length;

  useEffect(() => {
    let live = true;
    Promise.all([mainApi.clinics.list(), mainApi.specializations.list()])
      .then(([clinicList, specs]) => {
        if (!live) return;
        setClinics(clinicList);
        setSpecializations(specs);
      })
      .catch(() => {
        if (live) {
          setError(
            'Не удалось загрузить клиники и специализации. Раскройте карточку повторно.',
          );
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  async function applyChange(
    nextClinicId: string,
    nextRole: MembershipRole | null,
    nextSpecializationIds: number[],
  ) {
    if (blocked || inFlight.current) return;
    setClinicId(nextClinicId);
    setRole(nextRole);
    setSpecializationIds(nextSpecializationIds);
    setSaved(false);
    setError('');
    const update = buildMembershipUpdate(
      nextClinicId,
      nextRole,
      nextSpecializationIds,
    );
    if (!update || !membershipHasChanges(user, update)) return;
    inFlight.current = true;
    setSaving(true);
    onSavingChange?.(true);
    try {
      const result = await userMembershipApi.update(user.id, update);
      setClinicId(result.clinic_id ?? '');
      setRole(result.clinic_role);
      setSpecializationIds(result.specialization_ids);
      setSaved(true);
      onSaved(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось изменить клинику и доступ',
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  const clinicOptions = [
    { value: '', label: 'Без клиники — отключить доступ' },
    ...(user.clinic_id &&
    !clinics.some((clinic) => clinic.id === user.clinic_id)
      ? [
          {
            value: user.clinic_id,
            label: `${user.clinic_name} (недоступна)`,
            disabled: true,
          },
        ]
      : []),
    ...clinics.map((clinic) => ({
      value: clinic.id,
      label:
        clinic.name +
        (clinic.access_status_code === 'expired'
          ? ' — подписка завершена'
          : ''),
      disabled: clinic.access_status_code === 'expired',
    })),
  ];

  return (
    <div
      role="group"
      aria-label={`Клиника и доступ ${user.login}`}
      className="flex min-w-0 flex-col gap-5"
    >
      {loading && (
        <p
          role="status"
          className="text-sm text-[var(--ui-color-alabaster-950)]"
        >
          Загрузка клиник…
        </p>
      )}
      <UserSettingsField
        label="Клиника"
        hint="При переводе прежний доступ прекращается. Заполненные анкеты остаются в исходной клинике."
      >
        <CustomDropdown
          options={clinicOptions}
          value={clinicId}
          onChange={(value) => void applyChange(value, role, specializationIds)}
          disabled={blocked}
          aria-label="Клиника"
          triggerClassName="bg-[var(--ui-color-slate-200)]"
        />
      </UserSettingsField>
      {
        <UserSettingsField
          label="Роль"
          hint={
            !clinicId
              ? 'Выберите клинику, чтобы назначить сотруднику роль'
              : role === 'operator'
                ? 'Анкеты и пациентские ссылки своей клиники. Управление сотрудниками и помощники врача недоступны.'
                : 'Определяет доступ сотрудника к анкетам и функциям клиники'
          }
        >
          <CustomDropdown<MembershipRole | ''>
            options={roles}
            value={role ?? ''}
            onChange={(value) =>
              void applyChange(clinicId, value || null, specializationIds)
            }
            disabled={blocked || !roles.length}
            aria-label="Роль"
            placeholder="Выберите роль"
            triggerClassName="bg-[var(--ui-color-slate-200)]"
          />
        </UserSettingsField>
      }
      {clinicId && doctor && (
        <UserSettingsField
          label="Специализации врача"
          hint="Выберите хотя бы одну специализацию для врачебного доступа"
        >
          <CustomDropdown<number, true>
            multiple
            options={specializations.map((spec) => ({
              value: spec.id,
              label: spec.name,
            }))}
            value={specializationIds}
            onChange={(value) => void applyChange(clinicId, role, value)}
            disabled={blocked}
            aria-label="Специализации врача"
            placeholder="Выберите специализации"
            triggerClassName="bg-[var(--ui-color-slate-200)]"
            showCheckIcon
          />
        </UserSettingsField>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--ui-color-red-600)]">
          {error}
        </p>
      )}
      <p
        role="status"
        className="text-right text-sm text-[var(--ui-color-alabaster-950)]"
      >
        {saving
          ? 'Сохраняем…'
          : !payload
            ? 'Выберите специализацию для сохранения врачебной роли'
            : saved && !changed
              ? 'Сохранено'
              : ''}
      </p>
      {error && !loadFailed && (
        <button
          type="button"
          disabled={blocked}
          onClick={() => void applyChange(clinicId, role, specializationIds)}
          className="self-end text-sm text-[var(--ui-color-blue-600)] disabled:opacity-50"
        >
          Повторить
        </button>
      )}
    </div>
  );
}
