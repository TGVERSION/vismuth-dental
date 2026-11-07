'use client';

import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'react-toastify';
import type { ClinicMemberRead, SpecializationRead } from '@/api';
import type { useClinicMembers } from '@/hooks/useClinicMembers';
import { filterMembers, formatMemberName, visibleMembers } from '@/lib/clinics';
import { fieldFillClass } from '@/lib/field-fill';
import { ClinicMemberRow } from './ClinicMemberRow';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';
import { ErrorState, LINK_BUTTON_CLASS, Spinner } from './fields';

interface ClinicMembersProps {
  state: ReturnType<typeof useClinicMembers>;
  canAddDoctor: boolean;
  specializations: SpecializationRead[];
  onAdd: () => void;
  /** Состав врачей изменился — пересчитать `doctors_count` карточки. */
  onDoctorsChanged: () => void;
}

export const ClinicMembers = ({
  state,
  canAddDoctor,
  specializations,
  onAdd,
  onDoctorsChanged,
}: ClinicMembersProps) => {
  const [query, setQuery] = useState('');
  const [toDeactivate, setToDeactivate] = useState<ClinicMemberRead | null>(
    null,
  );

  const visible = visibleMembers(state.members);
  const found = filterMembers(visible, query);

  const deactivate = async (member: ClinicMemberRead) => {
    const ok = await state.deactivate(member.id);
    if (ok) {
      toast.success('Сотрудник удалён');
      if (member.is_doctor) onDoctorsChanged();
    } else {
      toast.error('Не удалось удалить сотрудника');
    }
    return ok;
  };

  return (
    <section aria-labelledby="clinic-members-title">
      <div className="flex items-center justify-between">
        <h4
          id="clinic-members-title"
          className="text-[length:var(--ui-font-size-31)] font-medium text-[var(--ui-color-alabaster-dark-800)]"
        >
          Сотрудники
        </h4>
        <button type="button" onClick={onAdd} className={LINK_BUTTON_CLASS}>
          Добавить
        </button>
      </div>

      <div className="relative mt-4">
        <Image
          src="/search.svg"
          alt=""
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск"
          aria-label="Поиск сотрудников"
          className={`h-10 w-full rounded-xl ${fieldFillClass(query)} pr-[var(--ui-space-14)] pl-10 text-sm outline-none focus:ring-2 focus:ring-[var(--ui-color-blue-600)]`}
        />
      </div>

      <div className="mt-3">
        {state.loading ? (
          <Spinner />
        ) : state.error ? (
          <ErrorState
            text="Не удалось загрузить сотрудников"
            onRetry={state.reload}
          />
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[var(--ui-color-alabaster-950)]">
            Сотрудников пока нет
          </p>
        ) : found.length === 0 ? (
          <p className="py-10 text-center text-[var(--ui-color-alabaster-950)]">
            Никого не нашли
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {found.map((member) => (
              <ClinicMemberRow
                key={member.id}
                member={member}
                canAddDoctor={canAddDoctor}
                specializations={specializations}
                onPatch={async (data) => {
                  const ok = await state.patchMember(member.id, data);
                  if (ok && data.is_doctor !== undefined) onDoctorsChanged();
                  return ok;
                }}
                onDeactivate={() => setToDeactivate(member)}
                onResend={() => state.resend(member.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {toDeactivate && (
        <ConfirmDeactivateModal
          name={formatMemberName(toDeactivate)}
          onConfirm={() => deactivate(toDeactivate)}
          onClose={() => setToDeactivate(null)}
        />
      )}
    </section>
  );
};
