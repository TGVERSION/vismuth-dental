'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
  onClose: () => void;
  onSavingChange?: (saving: boolean) => void;
}

export function UserClinicMembershipEditor({
  user,
  roles,
  disabled = false,
  onSaved,
  onClose,
  onSavingChange,
}: Props) {
  const [clinicId, setClinicId] = useState(user.clinic_id ?? '');
  const [role, setRole] = useState<MembershipRole | null>(user.clinic_role);
  const [specializationIds, setSpecializationIds] = useState(
    user.specialization_ids,
  );
  const [clinics, setClinics] = useState<ClinicRead[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationRead[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!payload || !changed || blocked) return;
    setSaving(true);
    onSavingChange?.(true);
    setError('');
    try {
      const saved = await userMembershipApi.update(user.id, payload);
      setClinicId(saved.clinic_id ?? '');
      setRole(saved.clinic_role);
      setSpecializationIds(saved.specialization_ids);
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось изменить клинику и доступ',
      );
    } finally {
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
    <form
      onSubmit={submit}
      aria-label={`Клиника и доступ ${user.login}`}
      className="flex min-w-0 flex-col gap-5"
    >
      {loading && (
        <p role="status" className="text-sm text-[#8B8B8B]">
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
          onChange={setClinicId}
          disabled={blocked}
          aria-label="Клиника"
          triggerClassName="bg-[#E3E8F1]"
        />
      </UserSettingsField>
      {clinicId && (
        <UserSettingsField
          label="Роль в клинике"
          hint={
            role === 'operator'
              ? 'Оператор видит анкеты и пациентские ссылки своей клиники. Управление сотрудниками и помощники врача недоступны.'
              : 'Определяет доступ сотрудника к анкетам и функциям клиники'
          }
        >
            <CustomDropdown<MembershipRole | ''>
            options={roles}
              value={role ?? ''}
              onChange={(value) => setRole(value || null)}
            disabled={blocked || !roles.length}
            aria-label="Роль в клинике"
            placeholder="Выберите роль"
            triggerClassName="bg-[#E3E8F1]"
          />
        </UserSettingsField>
      )}
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
            onChange={setSpecializationIds}
            disabled={blocked}
            aria-label="Специализации врача"
            placeholder="Выберите специализации"
            triggerClassName="bg-[#E3E8F1]"
            showCheckIcon
          />
        </UserSettingsField>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#E53E3E]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="cursor-pointer rounded-xl bg-[#F1F2F4] px-5 py-3 text-sm disabled:opacity-50"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={!payload || !changed || blocked}
          className="cursor-pointer rounded-xl bg-[#E8EEFF] px-5 py-3 text-sm text-[#202020] hover:bg-[#D6E0FF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}
