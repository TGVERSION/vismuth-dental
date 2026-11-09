'use client';

import { useMemo, useState } from 'react';
import type { PublicLinkDoctor } from '@/api';
import { collectSpecializations, filterDoctors } from '@/lib/questionnaire';
import { DoctorList } from './DoctorList';
import { FIELD_CLASS } from './field-styles';
import { SelectSheet } from './SelectSheet';
import { ChevronDownIcon, SearchIcon } from './icons';

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
      <h1 className="text-[24px] font-bold">Выберите врача</h1>

      <div className="relative mt-6">
        <div
          className={`${FIELD_CLASS} q-field-group flex min-w-0 items-center gap-2`}
        >
          <SearchIcon className="h-5 w-5 shrink-0 text-[var(--q-muted)]" />
          {specialization !== ALL_SPECIALIZATIONS && (
            <button
              type="button"
              disabled={isSelecting}
              onClick={() => setSpecialization(ALL_SPECIALIZATIONS)}
              aria-label={`Сбросить специализацию ${specialization}`}
              title={specialization}
              className="flex max-w-[45%] min-w-0 items-center gap-1 rounded-lg bg-[var(--q-bg)] px-2 py-1 text-sm"
            >
              <span className="truncate">{specialization}</span>
              <span aria-hidden="true">×</span>
            </button>
          )}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={isSelecting}
            placeholder={
              specialization === ALL_SPECIALIZATIONS
                ? 'Врач или специализация'
                : 'Врач'
            }
            aria-label="Поиск врача или специализации"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button
            type="button"
            aria-label="Выбрать специализацию"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            disabled={isSelecting}
            onClick={() => setSheetOpen((open) => !open)}
            className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--q-muted)]"
          >
            <ChevronDownIcon className="h-5 w-5" />
          </button>
        </div>
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
            <p className="text-sm text-[#C2334D]">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 min-h-[44px] rounded-xl bg-[var(--q-brand)] px-4 font-medium text-[var(--q-brand-contrast)]"
              >
                Повторить
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
