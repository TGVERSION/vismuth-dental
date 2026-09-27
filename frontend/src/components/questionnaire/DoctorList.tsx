'use client';

import type { QuestionnaireDoctor } from '@/api';
import { DoctorCard } from './DoctorCard';

interface DoctorListProps {
  doctors: QuestionnaireDoctor[];
  isLoading: boolean;
  error: string | null;
  isStarting: boolean;
  onReload: () => void;
  onSelect: (doctor: QuestionnaireDoctor) => void;
  /** Действие на пустой выдаче — например сброс фильтров на экране выбора. */
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

const SkeletonRow = () => (
  <div className="h-20 w-full animate-pulse rounded-2xl bg-[var(--q-surface)]" />
);

/**
 * Список врачей со всеми состояниями. Общий для экрана выбора и для заглушки
 * деактивированного врача, где ТЗ тоже требует показать список.
 */
export const DoctorList = ({
  doctors,
  isLoading,
  error,
  isStarting,
  onReload,
  onSelect,
  emptyActionLabel,
  onEmptyAction,
}: DoctorListProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl bg-[var(--q-surface)] p-4">
        <p>{error}</p>
        <button
          type="button"
          onClick={onReload}
          className="mt-3 min-h-[44px] rounded-xl bg-[var(--q-brand)] px-4 font-medium text-[var(--q-brand-contrast)]"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--q-surface)] p-4">
        <p>Врачей не нашлось.</p>
        {onEmptyAction && emptyActionLabel ? (
          <button
            type="button"
            onClick={onEmptyAction}
            className="mt-3 min-h-[44px] rounded-xl bg-[var(--q-brand)] px-4 font-medium text-[var(--q-brand-contrast)]"
          >
            {emptyActionLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor.id}
          doctor={doctor}
          onSelect={onSelect}
          disabled={isStarting}
        />
      ))}
    </div>
  );
};
