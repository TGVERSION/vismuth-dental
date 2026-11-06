'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { mainApi, type ClinicRead, type SpecializationRead } from '@/api';
import {
  userMembershipApi,
  type MembershipRole,
  type MembershipRoleOption,
  type UserMembershipRead,
} from '@/api/user-membership-api';
import { buildMembershipUpdate } from '@/lib/user-membership';
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from './clinics/ModalShell';

interface Props {
  user: UserMembershipRead;
  roles: MembershipRoleOption[];
  onSaved: (user: UserMembershipRead) => void;
  onClose: () => void;
}

const FIELD =
  'w-full rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] p-3 text-sm disabled:opacity-60';

export function UserClinicMembershipEditor({
  user,
  roles,
  onSaved,
  onClose,
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
            'Не удалось загрузить клиники и специализации. Откройте окно повторно.',
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
    if (!payload || loading || loadFailed || saving) return;
    setSaving(true);
    setError('');
    try {
      onSaved(await userMembershipApi.update(user.id, payload));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось изменить клинику и доступ',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Клиника и доступ"
      onClose={onClose}
      closeDisabled={saving}
    >
      <p className="mb-4 break-all text-sm text-[#6C757D]">{user.login}</p>
      {loading ? (
        <p role="status">Загрузка клиник…</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="text-sm">
            Клиника
            <select
              aria-label="Клиника"
              className={FIELD}
              value={clinicId}
              disabled={saving || loadFailed}
              onChange={(event) => setClinicId(event.target.value)}
            >
              <option value="">Без клиники — отключить доступ</option>
              {user.clinic_id &&
                !clinics.some((clinic) => clinic.id === user.clinic_id) && (
                  <option value={user.clinic_id}>
                    {user.clinic_name} (недоступна)
                  </option>
                )}
              {clinics.map((clinic) => (
                <option
                  key={clinic.id}
                  value={clinic.id}
                  disabled={clinic.access_status_code === 'expired'}
                >
                  {clinic.name}
                  {clinic.access_status_code === 'expired'
                    ? ' — подписка завершена'
                    : ''}
                </option>
              ))}
            </select>
          </label>
          {clinicId && (
            <label className="text-sm">
              Роль в клинике
              <select
                aria-label="Роль в клинике"
                className={FIELD}
                value={role ?? ''}
                disabled={saving || loadFailed}
                onChange={(event) =>
                  setRole((event.target.value || null) as MembershipRole | null)
                }
              >
                <option value="">Выберите роль</option>
                {roles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {clinicId && doctor && (
            <fieldset disabled={saving || loadFailed}>
              <legend className="mb-2 text-sm">Специализации врача</legend>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-[#E9ECEF] p-3">
                {specializations.map((spec) => (
                  <label
                    key={spec.id}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={specializationIds.includes(spec.id)}
                      onChange={(event) =>
                        setSpecializationIds((previous) =>
                          event.target.checked
                            ? [...previous, spec.id]
                            : previous.filter((id) => id !== spec.id),
                        )
                      }
                    />
                    {spec.name}
                  </label>
                ))}
              </div>
              {!specializationIds.length && (
                <p className="mt-1 text-sm text-[#6C757D]">
                  Выберите хотя бы одну специализацию.
                </p>
              )}
            </fieldset>
          )}
          {clinicId && role === 'operator' && (
            <p className="text-sm text-[#6C757D]">
              Оператор видит анкеты и пациентские ссылки своей клиники, печатает
              и отмечает подпись. Управление сотрудниками, клиникой и помощники
              врача недоступны.
            </p>
          )}
          <p className="text-sm text-[#6C757D]">
            При смене клиники доступ к прежней клинике прекращается. Её анкеты
            сохраняются в прежней клинике. При отключении клиники рабочий доступ
            пользователя закрывается.
          </p>
          {error && (
            <p role="alert" className="text-sm text-[#E53E3E]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!payload || saving || loadFailed}
            className={PRIMARY_BUTTON_CLASS}
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={SECONDARY_BUTTON_CLASS}
          >
            Отмена
          </button>
        </form>
      )}
      {loading && error && <p role="alert">{error}</p>}
    </ModalShell>
  );
}
