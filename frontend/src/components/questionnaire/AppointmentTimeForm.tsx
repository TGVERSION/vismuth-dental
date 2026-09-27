'use client';

import { useMemo, useState } from 'react';
import { SpinnerButton } from '@/components/SpinnerButton';
import { formatDateLabel } from '@/lib/calendar';
import { appointmentDateRange, isDateWithinRange } from '@/lib/questionnaire';
import { SheetField } from './SheetField';
import { DateSheet } from './DateSheet';
import { TimeSheet } from './TimeSheet';
import { CalendarIcon, ClockIcon } from './icons';

interface AppointmentTimeFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: { date: string; time: string }) => void;
}

/** Дата и время приёма — отдельный шаг после имени. */
export const AppointmentTimeForm = ({
  isSubmitting,
  error,
  onSubmit,
}: AppointmentTimeFormProps) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [touched, setTouched] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);

  // «Сегодня» фиксируется один раз за монтирование и используется и для
  // границ выбора, и для проверки при отправке: иначе у вкладки, открытой
  // через полночь, они разойдутся.
  const today = useMemo(() => new Date(), []);
  const range = useMemo(() => appointmentDateRange(today), [today]);

  const dateValid = isDateWithinRange(date, today);
  const canSubmit = dateValid && time !== '' && !isSubmitting;

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
      <h1 className="text-2xl font-semibold">Когда у вас приём?</h1>

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

        {dateSheetOpen ? (
          <DateSheet
            min={range.min}
            max={range.max}
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
      {touched && time === '' ? (
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
          disabled={isSubmitting}
          className="min-h-[52px] w-full rounded-xl bg-[var(--q-brand)] px-4 text-base font-medium text-[var(--q-brand-contrast)] disabled:opacity-60"
        >
          {isSubmitting ? <SpinnerButton /> : 'Подтвердить'}
        </button>
      </div>
    </form>
  );
};
