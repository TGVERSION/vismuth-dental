'use client';

import type { PublicLinkDoctor } from '@/api';
import { DoctorCard } from './DoctorCard';

interface DoctorListProps {
  doctors: PublicLinkDoctor[];
  /** Идёт отправка выбора: список заблокирован. */
  isSelecting: boolean;
  /** Чей выбор отправляется — на его карточке спиннер. */
  pendingId?: string | null;
  onSelect: (doctor: PublicLinkDoctor) => void;
  /** Действие на пустой выдаче — например сброс фильтров на экране выбора. */
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

/**
 * Список врачей. Общий для экрана выбора и для заглушки деактивированного
 * врача, где ТЗ тоже требует показать список.
 *
 * Отдельной загрузки нет: врачи приходят в ссылке и в шаге `choose_doctor`.
 */
export const DoctorList = ({
  doctors,
  isSelecting,
  pendingId = null,
  onSelect,
  emptyActionLabel,
  onEmptyAction,
}: DoctorListProps) => {
  if (doctors.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--q-surface)] p-4">
        <p>Врачей не нашлось.</p>
        {onEmptyAction && emptyActionLabel ? (
          <button
            type="button"
            onClick={onEmptyAction}
            className="q-button mt-3"
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
          key={doctor.membership_id}
          doctor={doctor}
          onSelect={onSelect}
          disabled={isSelecting}
          isPending={isSelecting && pendingId === doctor.membership_id}
        />
      ))}
    </div>
  );
};
