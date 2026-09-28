'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import type { ClinicInvitationCreated, SpecializationRead } from '@/api';
import { CustomDropdown } from '@/components/CustomDropdown';
import {
  MEMBER_ROLE_OPTIONS,
  filterOptions,
  isValidEmail,
  memberRolesToFlags,
  type MemberRole,
} from '@/lib/clinics';
import type { InviteResult } from '@/hooks/useClinicMembers';
import { fieldFillClass } from '@/lib/field-fill';
import type { ClinicMemberInviteCreate } from '@/api';
import { INPUT_CLASS } from './fields';
import { InviteLinkResult } from './InviteLinkResult';
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from './ModalShell';

interface InviteMemberModalProps {
  defaultRoles: MemberRole[];
  /** Лимит врачей не достигнут. */
  canAddDoctor: boolean;
  specializations: SpecializationRead[];
  onInvite: (data: ClinicMemberInviteCreate) => Promise<InviteResult>;
  onClose: () => void;
}

export const InviteMemberModal = ({
  defaultRoles,
  canAddDoctor,
  specializations,
  onInvite,
  onClose,
}: InviteMemberModalProps) => {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<MemberRole[]>(() =>
    defaultRoles.filter((role) => role !== 'doctor' || canAddDoctor),
  );
  const [specializationIds, setSpecializationIds] = useState<number[]>([]);
  const [specQuery, setSpecQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClinicInvitationCreated | null>(null);

  const isDoctor = roles.includes('doctor');
  const canSubmit =
    isValidEmail(email) &&
    roles.length > 0 &&
    (!isDoctor || specializationIds.length > 0) &&
    !submitting;

  const roleOptions = MEMBER_ROLE_OPTIONS.map((option) => ({
    ...option,
    disabled: option.value === 'doctor' && !canAddDoctor,
  }));

  const specOptions = filterOptions(
    specializations.map((spec) => ({ value: spec.id, label: spec.name })),
    specQuery,
    specializationIds,
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    const response = await onInvite({
      email: email.trim(),
      ...memberRolesToFlags(roles),
      specialization_ids: isDoctor ? specializationIds : [],
    });
    setSubmitting(false);

    if (!response.ok) {
      setError(response.message);
      return;
    }
    if (response.invitation.email_sent) {
      toast.success(`Приглашение отправлено на ${response.invitation.email}`);
      onClose();
      return;
    }
    setResult(response.invitation);
  };

  return (
    <ModalShell
      title="Приглашение сотрудника"
      onClose={onClose}
      closeDisabled={submitting}
    >
      {result ? (
        <>
          <InviteLinkResult invitation={result} />
          <button
            type="button"
            onClick={onClose}
            className={`mt-7.5 ${PRIMARY_BUTTON_CLASS}`}
          >
            Готово
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="mb-7.5 text-[18px] text-[#6C757D]">
            На указанную почту придёт письмо со ссылкой. Сотрудник перейдёт по
            ней, задаст пароль и сможет войти. Ссылка действует 7 дней
          </p>

          <div className="flex gap-5">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="pochta@mail.ru"
              aria-label="Почта сотрудника"
              autoFocus
              className={`${INPUT_CLASS} ${fieldFillClass(email)}`}
            />
            <div className="w-35 shrink-0">
              <CustomDropdown<MemberRole, true>
                multiple
                options={roleOptions}
                value={roles}
                onChange={setRoles}
                triggerClassName={fieldFillClass(roles)}
                placeholder="Роль"
                aria-label="Роль сотрудника"
              />
            </div>
          </div>

          {!canAddDoctor && (
            <p className="mt-2 text-xs text-[#6C757D]">
              Достигнут лимит врачей — пригласить можно только администратора
            </p>
          )}

          {isDoctor && (
            <div className="mt-4">
              <CustomDropdown<number, true>
                multiple
                options={specOptions}
                value={specializationIds}
                onChange={setSpecializationIds}
                triggerClassName={fieldFillClass(specializationIds)}
                onSearch={setSpecQuery}
                placeholder="Специализация"
                aria-label="Специализация"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-[#E53E3E]">
              {error}
            </p>
          )}

          <div className="mt-7.5 flex flex-col gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={PRIMARY_BUTTON_CLASS}
            >
              {submitting ? 'Отправляем…' : 'Пригласить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Отменить
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
};
