'use client';

import { useState } from 'react';
import { SpinnerButton } from '@/components/SpinnerButton';
import { formatDateLabel } from '@/lib/calendar';
import { isDateInRange } from '@/lib/questionnaire';
import { SheetField } from './SheetField';
import { DateSheet } from './DateSheet';
import { TimeSheet } from './TimeSheet';
import { CalendarIcon, ClockIcon } from './icons';

interface AppointmentTimeFormProps {
  /** Границы выбора даты из шага, `YYYY-MM-DD` по часам сервера. */
  dateMin: string | null;
  dateMax: string | null;
  /** Разрешённое время приёма из шага, `HH:MM`. */
  timeSlots: string[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: { date: string; time: string }) => void;
}

/**
 * Дата и время приёма — отдельный шаг после имени.
 *
 * Диапазон дат и слоты времени приходят с сервера: он проверяет ответ по
 * своим часам и своим слотам, и значение, выбранное по часам телефона или
 * вне слотов, получило бы отказ.
 */
export const AppointmentTimeForm = ({
  dateMin,
  dateMax,
  timeSlots,
  isSubmitting,
  error,
  onSubmit,
}: AppointmentTimeFormProps) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [touched, setTouched] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);

  // Без слотов или без диапазона дат выбрать нечего: сервер отклонит любое
  // значение. Диапазон backend присылает всегда — проверка на всякий случай.
  const hasSlots = timeSlots.length > 0 && Boolean(dateMin && dateMax);
  const dateValid = isDateInRange(date, dateMin, dateMax);
  const timeValid = timeSlots.includes(time);
  const canSubmit = dateValid && timeValid && !isSubmitting;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!canSubmit) return;

        onSubmit({ date, time });
      }}
      className="q-screen flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+24px)]"
    >
      <h1 className="text-[24px] font-bold">Когда у вас приём?</h1>

      {/* relative — опора для выпадающего списка на десктопе. */}
      <div className="relative mt-6">
        <SheetField
          value={formatDateLabel(date)}
          placeholder="Дата"
          ariaLabel="Дата приёма"
          onClick={() => setDateSheetOpen((open) => !open)}
          icon={<CalendarIcon className="h-5 w-5" />}
          className="min-h-[52px] w-full"
        />

        {dateSheetOpen && dateMin && dateMax ? (
          <DateSheet
            min={dateMin}
            max={dateMax}
            value={date}
            onClose={() => setDateSheetOpen(false)}
            onApply={(next) => {
              setDate(next);
              setDateSheetOpen(false);
            }}
          />
        ) : null}
      </div>
      {touched && !dateValid ? (
        <p role="alert" className="mt-1 text-sm text-[#C2334D]">
          Выберите дату в ближайшие 30 дней
        </p>
      ) : null}

      {hasSlots ? (
        <div className="relative mt-3">
          <SheetField
            value={time}
            placeholder="Время"
            ariaLabel="Время приёма"
            onClick={() => setTimeSheetOpen((open) => !open)}
            icon={<ClockIcon className="h-5 w-5" />}
            className="min-h-[52px] w-full"
          />

          {timeSheetOpen ? (
            <TimeSheet
              slots={timeSlots}
              value={time}
              onClose={() => setTimeSheetOpen(false)}
              onApply={(next) => {
                setTime(next);
                setTimeSheetOpen(false);
              }}
              // Десктоп: время складывается из двух значений, поэтому выбор
              // применяется сразу, а список закроется кликом вне.
              onChange={setTime}
            />
          ) : null}
        </div>
      ) : (
        <p role="alert" className="mt-3 text-sm text-[#C2334D]">
          Нет доступного времени, обратитесь в клинику
        </p>
      )}
      {hasSlots && touched && !timeValid ? (
        <p role="alert" className="mt-1 text-sm text-[#C2334D]">
          Выберите время
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-[#C2334D]">
          {error}
        </p>
      ) : null}

      <div className="mt-auto pb-[calc(env(safe-area-inset-bottom)+16px)] pt-8">
        <button
          type="submit"
          disabled={isSubmitting || !hasSlots}
          className="min-h-[52px] w-full rounded-xl bg-[var(--q-brand)] px-4 text-base font-medium text-[var(--q-brand-contrast)] disabled:opacity-60"
        >
          {isSubmitting ? <SpinnerButton /> : 'Подтвердить'}
        </button>
      </div>
    </form>
  );
};
