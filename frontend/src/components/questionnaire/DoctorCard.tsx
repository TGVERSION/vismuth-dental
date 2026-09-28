'use client';

import type { PublicLinkDoctor } from '@/api';
import { SafeImage } from '@/components/SafeImage';
import { doctorFullName, doctorSpecializationNames } from '@/lib/questionnaire';

interface DoctorCardProps {
  doctor: PublicLinkDoctor;
  onSelect: (doctor: PublicLinkDoctor) => void;
  disabled?: boolean;
  /** Выбор этого врача отправляется — на карточке спиннер. */
  isPending?: boolean;
}

const initials = (fullName: string): string =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const DoctorCard = ({
  doctor,
  onSelect,
  disabled = false,
  isPending = false,
}: DoctorCardProps) => {
  const fullName = doctorFullName(doctor);

  return (
    <button
      type="button"
      onClick={() => onSelect(doctor)}
      disabled={disabled}
      aria-busy={isPending || undefined}
      className="flex w-full items-center gap-3 rounded-2xl bg-[var(--q-surface)] p-3 text-left disabled:opacity-60"
    >
      <SafeImage
        src={doctor.photo_url}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
        fallback={
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--q-brand)] text-base font-medium text-[var(--q-brand-contrast)]"
          >
            {initials(fullName)}
          </span>
        }
      />

      <span className="min-w-0 flex-1">
        <span className="block font-medium">{fullName}</span>
        <span className="mt-1 block text-sm text-[var(--q-brand)]">
          {doctorSpecializationNames(doctor).join(', ')}
        </span>
      </span>

      {isPending ? (
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--q-brand)] border-t-transparent"
        />
      ) : null}
    </button>
  );
};
