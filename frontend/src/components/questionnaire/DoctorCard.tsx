'use client';

import type { QuestionnaireDoctor } from '@/api';
import { SafeImage } from '@/components/SafeImage';

interface DoctorCardProps {
  doctor: QuestionnaireDoctor;
  onSelect: (doctor: QuestionnaireDoctor) => void;
  disabled?: boolean;
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
}: DoctorCardProps) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(doctor)}
      disabled={disabled}
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
            {initials(doctor.full_name)}
          </span>
        }
      />

      <span className="min-w-0">
        <span className="block font-medium">{doctor.full_name}</span>
        <span className="mt-1 block text-sm text-[var(--q-brand)]">
          {doctor.specializations.join(', ')}
        </span>
      </span>
    </button>
  );
};
