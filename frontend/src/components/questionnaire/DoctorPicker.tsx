'use client';

import { useMemo, useState } from 'react';
import type { PublicLinkDoctor } from '@/api';
import { collectSpecializations, filterDoctors } from '@/lib/questionnaire';
import { DoctorList } from './DoctorList';
import { FIELD_CLASS } from './field-styles';
import { SheetField } from './SheetField';
import { SelectSheet } from './SelectSheet';
import { SearchIcon } from './icons';

interface DoctorPickerProps {
  doctors: PublicLinkDoctor[];
  /** Идёт отправка выбора: список заблокирован. */
  isSelecting: boolean;
  /** Чей выбор отправляется — на его карточке спиннер. */
  pendingId: string | null;
  error: string | null;
  /** Повторить последний выбор после ошибки. */
  onRetry?: () => void;
  onSelect: (doctor: PublicLinkDoctor) => void;
}

/** Маркер «без фильтра»: в списке это отдельный вариант «Все специализации». */
const ALL_SPECIALIZATIONS = 'all';

export const DoctorPicker = ({
  doctors,
  isSelecting,
  pendingId,
  error,
  onRetry,
  onSelect,
}: DoctorPickerProps) => {
  const [query, setQuery] = useState('');
  const [specialization, setSpecialization] = useState(ALL_SPECIALIZATIONS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Фильтрация клиентская: список врачей клиники мал, серверный поиск
  // добавил бы только гонки запросов.
  const visible = useMemo(
    () =>
      filterDoctors(
        doctors,
        query,
        specialization === ALL_SPECIALIZATIONS ? '' : specialization,
      ),
    [doctors, query, specialization],
  );

  // Фильтр — по названиям специализаций из карточек: отдельного
  // справочника у публичного контракта нет.
  const options = useMemo(
    () => [
      { value: ALL_SPECIALIZATIONS, label: 'Все специализации' },
      ...collectSpecializations(doctors).map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [doctors],
  );

  const hasFilters = query !== '' || specialization !== ALL_SPECIALIZATIONS;

  const resetFilters = () => {
    setQuery('');
    setSpecialization(ALL_SPECIALIZATIONS);
  };

  return (
    <div className="q-screen flex flex-col px-4 pt-8">
      <h1 className="text-[length:var(--ui-font-size-26)] font-bold">
        Выберите врача
      </h1>

      <div className="mt-6 flex gap-2">
        <div
          className={`${FIELD_CLASS} flex min-w-0 flex-1 items-center gap-2`}
        >
          <SearchIcon className="h-5 w-5 shrink-0 text-[var(--q-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Врач"
            aria-label="Поиск врача по фамилии или имени"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>

        {/* relative нужен выпадающему списку на десктопе: он позиционируется
            относительно этого контейнера. Ширина поля — из макета. */}
        <div className="relative w-[184px] shrink-0">
          <SheetField
            value={specialization === ALL_SPECIALIZATIONS ? '' : specialization}
            placeholder="Специализация"
            ariaLabel="Фильтр по специализации"
            onClick={() => setSheetOpen((open) => !open)}
            className="w-full"
          />

          {/* Монтируется только когда открыт: состояние выбора начинается
              заново при каждом открытии, без синхронизации эффектом. */}
          {sheetOpen ? (
            <SelectSheet
              title="Специализация"
              options={options}
              value={specialization}
              onClose={() => setSheetOpen(false)}
              onApply={(next) => {
                setSpecialization(next);
                setSheetOpen(false);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <DoctorList
          doctors={visible}
          isSelecting={isSelecting}
          pendingId={pendingId}
          onSelect={onSelect}
          emptyActionLabel={hasFilters ? 'Сбросить фильтры' : undefined}
          onEmptyAction={hasFilters ? resetFilters : undefined}
        />

        {error && !isSelecting ? (
          <div role="alert" className="rounded-2xl bg-[var(--q-surface)] p-4">
            <p className="text-sm text-[var(--ui-color-red-700)]">{error}</p>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="q-button mt-3">
                Повторить
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
