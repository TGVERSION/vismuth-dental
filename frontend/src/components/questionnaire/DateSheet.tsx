'use client';

import { useMemo, useState } from 'react';
import { WEEKDAY_LABELS, buildCalendarMonths } from '@/lib/calendar';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { PickerShell } from './PickerShell';
import { BackIcon } from './icons';

interface DateSheetProps {
  /** Границы выбора, `YYYY-MM-DD`. */
  min: string;
  max: string;
  value: string;
  onClose: () => void;
  onApply: (value: string) => void;
}

export const DateSheet = ({
  min,
  max,
  value,
  onClose,
  onApply,
}: DateSheetProps) => {
  const isDesktop = useIsDesktop();
  const [draft, setDraft] = useState(value);

  const months = useMemo(() => buildCalendarMonths(min, max), [min, max]);

  // На десктопе показывается один месяц с переключением, поэтому нужен его
  // индекс. Начинаем с месяца уже выбранной даты, иначе с первого
  // доступного — то есть с текущего, ведь нижняя граница это сегодня.
  const [monthIndex, setMonthIndex] = useState(() => {
    if (!value) return 0;

    const found = months.findIndex((month) =>
      month.days.some((day) => day?.date === value),
    );
    return found === -1 ? 0 : found;
  });

  const choose = (date: string) => {
    if (isDesktop) {
      // Обычный календарь применяет дату сразу — подтверждать нечего.
      onApply(date);
      return;
    }

    setDraft(date);
  };

  const visibleMonths = isDesktop ? [months[monthIndex]] : months;

  return (
    <PickerShell
      title="Дата приёма"
      onClose={onClose}
      size="fit"
      footer={
        isDesktop ? undefined : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDraft('')}
              data-variant="outline"
              className="q-button flex-1"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              disabled={draft === ''}
              className="q-button flex-1"
            >
              Готово
            </button>
          </div>
        )
      }
    >
      <div className={isDesktop ? 'p-3' : 'px-4'}>
        {isDesktop ? (
          <div className="flex items-center justify-between pb-2">
            <button
              type="button"
              onClick={() => setMonthIndex((index) => index - 1)}
              disabled={monthIndex === 0}
              aria-label="Предыдущий месяц"
              className="q-icon-button flex items-center justify-center disabled:opacity-30"
            >
              <BackIcon className="h-4 w-4" />
            </button>

            <span className="text-sm font-medium">
              {months[monthIndex].title}
            </span>

            <button
              type="button"
              onClick={() => setMonthIndex((index) => index + 1)}
              disabled={monthIndex === months.length - 1}
              aria-label="Следующий месяц"
              className="q-icon-button flex items-center justify-center disabled:opacity-30"
            >
              <BackIcon className="h-4 w-4 rotate-180" />
            </button>
          </div>
        ) : null}

        <div
          className={`grid grid-cols-7 gap-1 bg-white pb-2 text-center text-sm text-[var(--q-muted)] ${
            isDesktop ? '' : 'sticky top-0 z-10'
          }`}
        >
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        {visibleMonths.map((month) => (
          <section key={month.title} className={isDesktop ? '' : 'pb-4'}>
            {/* На десктопе месяц подписан в шапке переключателя. */}
            {isDesktop ? null : (
              <h3 className="py-2 font-medium">{month.title}</h3>
            )}

            <div className="grid grid-cols-7 gap-1">
              {month.days.map((day, index) =>
                day === null ? (
                  // Пустая клетка до первого числа: своей даты у неё нет,
                  // поэтому ключом служит позиция в сетке.
                  <span key={`empty-${index}`} />
                ) : (
                  <button
                    key={day.date}
                    type="button"
                    disabled={day.disabled}
                    onClick={() => choose(day.date)}
                    aria-pressed={draft === day.date}
                    // Ховер — только у невыбранных дней: иначе он перекрыл
                    // бы фирменный фон выбранного, а светлый текст остался
                    // бы и число пропадало под курсором.
                    className={`q-select-option flex items-center justify-center rounded-xl disabled:opacity-30 ${
                      isDesktop ? 'h-9 text-sm' : 'h-11 text-base'
                    } ${
                      draft === day.date
                        ? 'bg-[var(--q-brand)] font-medium text-[var(--q-brand-contrast)]'
                        : isDesktop
                          ? 'hover:bg-gray-50'
                          : ''
                    }`}
                  >
                    {day.day}
                  </button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </PickerShell>
  );
};
