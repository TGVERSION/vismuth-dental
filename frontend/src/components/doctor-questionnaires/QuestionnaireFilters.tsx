'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import type { QuestionnaireVisitType } from '@/api';
import {
  CustomDropdown,
  type DropdownOption,
} from '@/components/CustomDropdown';
import { DateField } from '@/components/DateField';
import { formatDateLabel, formatDateNumeric } from '@/lib/calendar';
import {
  VISIT_TYPES,
  doctorDateRange,
  isVisitType,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { fieldFillClass } from '@/lib/field-fill';

const VISIT_TYPE_OPTIONS: DropdownOption<string>[] = [
  { value: '', label: 'Все типы' },
  ...VISIT_TYPES.map((type) => ({
    value: type,
    label: visitTypeLabel(type) ?? type,
  })),
];

interface QuestionnaireFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  visitType: QuestionnaireVisitType | '';
  onVisitTypeChange: (value: QuestionnaireVisitType | '') => void;
}

/**
 * Фильтры списка анкет. Дата выбрана всегда — её можно сменить, но не
 * очистить. Фон полей — по правилу `field-fill`: пустое светлее, заполненное
 * темнее.
 */
export const QuestionnaireFilters = ({
  search,
  onSearchChange,
  date,
  onDateChange,
  visitType,
  onVisitTypeChange,
}: QuestionnaireFiltersProps) => {
  const range = useMemo(() => doctorDateRange(), []);

  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-[15px] bg-white p-3">
      <label className="relative block">
        <span className="sr-only">Код или имя пациента</span>
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
          placeholder="Код или имя пациента"
          autoComplete="off"
          maxLength={100}
          className={`h-10 w-full rounded-xl ${fieldFillClass(search)} pr-3 pl-10 text-sm text-[#202020] placeholder:text-[#A0A7B0] focus:ring-2 focus:ring-[#5D8CF1] focus:outline-none`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <DateField
          value={date}
          onChange={onDateChange}
          min={range.min}
          max={range.max}
          formatValue={formatDateNumeric}
          popoverAlign="left"
          aria-label={`Дата приёма: ${formatDateLabel(date)}`}
        />

        <CustomDropdown<string>
          options={VISIT_TYPE_OPTIONS}
          value={visitType}
          onChange={(value) =>
            onVisitTypeChange(isVisitType(value) ? value : '')
          }
          placeholder="Тип приёма"
          aria-label="Тип приёма"
          triggerClassName={fieldFillClass(visitType)}
          // Опция «Все типы» выбрана при пустом значении, и без своего
          // триггера в поле стояло бы «Все типы», а не заглушка макета.
          renderTrigger={(option) => {
            const selected = Array.isArray(option) ? option[0] : option;
            return selected?.value ? (
              <span className="truncate text-sm text-[#202020]">
                {selected.label}
              </span>
            ) : (
              <span className="truncate text-sm text-[#A0A7B0]">
                Тип приёма
              </span>
            );
          }}
        />
      </div>
    </div>
  );
};
