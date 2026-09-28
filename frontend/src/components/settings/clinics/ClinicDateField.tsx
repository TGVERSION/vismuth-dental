'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  WEEKDAY_LABELS,
  buildCalendarMonths,
  formatDateLabel,
} from '@/lib/calendar';
import { fieldFillClass } from '@/lib/field-fill';

interface ClinicDateFieldProps {
  id?: string;
  /** `YYYY-MM-DD` или пусто. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Поле даты с выпадающим календарём. Дата окончания доступа может быть и в
 * прошлом (подписка завершилась), поэтому диапазон — от начала прошлого года
 * на десять лет вперёд.
 */
export const ClinicDateField = ({
  id,
  value,
  onChange,
  placeholder = 'До',
}: ClinicDateFieldProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const months = useMemo(() => {
    const year = new Date().getFullYear();
    return buildCalendarMonths(`${year - 1}-01-01`, `${year + 10}-12-31`);
  }, []);

  const monthIndexOf = (date: string): number => {
    const prefix = date.slice(0, 7);
    const index = months.findIndex((month) =>
      month.days.some((day) => day?.date.startsWith(prefix)),
    );
    return index === -1 ? 0 : index;
  };

  const todayIso = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  })();

  const [monthIndex, setMonthIndex] = useState(() =>
    monthIndexOf(value || todayIso),
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const open = () => {
    setMonthIndex(monthIndexOf(value || todayIso));
    setIsOpen((prev) => !prev);
  };

  const month = months[monthIndex];
  const title = month.title.includes(' ')
    ? month.title
    : `${month.title} ${month.days.find(Boolean)?.date.slice(0, 4)}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-xl ${fieldFillClass(value)} px-3.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#5D8CF1]`}
      >
        <span className={value ? 'text-[#202020]' : 'text-[#A0A7B0]'}>
          {value ? formatDateLabel(value) : placeholder}
        </span>
        <Image src="/calendar.svg" alt="" width={18} height={18} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Выбор даты"
          className="absolute right-0 z-20 mt-2 w-72 rounded-xl bg-white p-3 shadow-custom"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthIndex((index) => Math.max(0, index - 1))}
              disabled={monthIndex === 0}
              aria-label="Предыдущий месяц"
              className="h-8 w-8 cursor-pointer rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-[#202020]">{title}</span>
            <button
              type="button"
              onClick={() =>
                setMonthIndex((index) => Math.min(months.length - 1, index + 1))
              }
              disabled={monthIndex === months.length - 1}
              aria-label="Следующий месяц"
              className="h-8 w-8 cursor-pointer rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#6C757D]">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
            {month.days.map((day, index) =>
              day ? (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => {
                    onChange(day.date);
                    setIsOpen(false);
                  }}
                  aria-pressed={day.date === value}
                  className={`h-8 cursor-pointer rounded-lg ${
                    day.date === value
                      ? 'bg-[#5D8CF1] text-white'
                      : 'text-[#202020] hover:bg-gray-100'
                  }`}
                >
                  {day.day}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
};
