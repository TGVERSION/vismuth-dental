'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { DateField } from '@/components/DateField';
import { formatDateLabel, formatDateNumeric } from '@/lib/calendar';
import { doctorDateRange } from '@/lib/doctor-questionnaires';
import { fieldFillClass } from '@/lib/field-fill';

interface QuestionnaireFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  markedDates?: readonly string[];
  dateLabel?: string;
  searchLabel?: string;
  onClearDate?: () => void;
  children?: React.ReactNode;
}

/**
 * Общие фильтры списка анкет. У врача дата выбрана всегда; регистратура
 * может снять её через onClearDate. Фон полей — по правилу `field-fill`: пустое светлее, заполненное
 * темнее.
 */
export const QuestionnaireFilters = ({
  search,
  onSearchChange,
  date,
  onDateChange,
  markedDates,
  dateLabel = 'Дата приёма',
  searchLabel = 'Имя пациента',
  onClearDate,
  children,
}: QuestionnaireFiltersProps) => {
  const range = useMemo(() => doctorDateRange(), []);

  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-[15px] bg-white p-3">
      <label className="relative block">
        <span className="sr-only">{searchLabel}</span>
        <Image
          src="/search.svg"
          alt=""
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchLabel}
          autoComplete="off"
          maxLength={100}
          className={`h-10 w-full rounded-xl ${fieldFillClass(search)} pr-3 pl-10 text-sm text-[#202020] placeholder:text-[#A0A7B0] focus:ring-2 focus:ring-[#5D8CF1] focus:outline-none`}
        />
      </label>

      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 flex-1">
          <DateField
            markedDates={markedDates}
            value={date}
            onChange={onDateChange}
            min={range.min}
            max={range.max}
            formatValue={formatDateNumeric}
            popoverAlign="left"
            placeholder="Все даты"
            aria-label={`${dateLabel}: ${date ? formatDateLabel(date) : 'Все даты'}`}
          />
        </div>
        {onClearDate && date ? (
          <button
            type="button"
            onClick={onClearDate}
            className="min-h-10 shrink-0 cursor-pointer px-1 text-sm text-[var(--ui-color-blue-600)]"
          >
            Все даты
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
};
