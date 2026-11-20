'use client';

import Image from 'next/image';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  WEEKDAY_LABELS,
  buildCalendarMonths,
  formatDateLabel,
  formatDateNumeric,
  maskDateNumericInput,
  parseDateNumeric,
} from '@/lib/calendar';
import { fieldFillClass } from '@/lib/field-fill';
import { toDateInputValue } from '@/lib/questionnaire';

export interface DateFieldProps {
  id?: string;
  /** `YYYY-MM-DD` или пусто. */
  value: string;
  onChange: (value: string) => void;
  timePicker?: {
    value: string;
    onChange: (date: string, time: string) => void;
  };
  disabled?: boolean;
  placeholder?: string;
  /** Первый доступный день, `YYYY-MM-DD`. По умолчанию — 1 января прошлого года. */
  min?: string;
  /** Последний доступный день. По умолчанию — 31 декабря через десять лет. */
  max?: string;
  /** Подпись значения в поле. По умолчанию «24 сентября 2026». */
  formatValue?: (value: string) => string;
  /** С какого края поля раскрывается календарь. */
  popoverAlign?: 'left' | 'right';
  markedDates?: readonly string[];
  /** Ввод даты рождения с клавиатуры и быстрый переход к месяцу и году. */
  birthDate?: {
    required?: boolean;
    autoComplete?: 'bday' | 'off';
  };
  'aria-label'?: string;
}

const defaultRange = (): { min: string; max: string } => {
  const year = new Date().getFullYear();
  return { min: `${year - 1}-01-01`, max: `${year + 10}-12-31` };
};

const TIME_SLOTS = Array.from(
  { length: 96 },
  (_, index) =>
    `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
);

const BIRTH_CALENDAR_START = '1900-01-01';

const getMonthKey = (month: ReturnType<typeof buildCalendarMonths>[number]) =>
  month.days.find(Boolean)?.date.slice(0, 7) ?? '';

/**
 * Поле даты с выпадающим календарём в стиле зоны врача. Фон — по правилу
 * `field-fill`: пустое поле светлее, заполненное темнее. Дни вне диапазона
 * показываются, но выбрать их нельзя.
 */
export const DateField = ({
  id,
  value,
  onChange,
  timePicker,
  disabled = false,
  placeholder = 'Дата',
  min,
  max,
  formatValue = formatDateLabel,
  popoverAlign = 'right',
  markedDates = [],
  birthDate,
  'aria-label': ariaLabel,
}: DateFieldProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const errorId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [manualDraft, setManualDraft] = useState<{
    text: string;
    date: string;
  }>();
  const [showInputError, setShowInputError] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const isBirthDate = Boolean(birthDate);
  const todayIso = toDateInputValue(new Date());
  const firstBirthDate = min ?? BIRTH_CALENDAR_START;
  const lastBirthDate = max ?? todayIso;

  const months = useMemo(() => {
    const fallback = defaultRange();
    return buildCalendarMonths(
      isBirthDate ? firstBirthDate : (min ?? fallback.min),
      isBirthDate ? lastBirthDate : (max ?? fallback.max),
    );
  }, [min, max, isBirthDate, firstBirthDate, lastBirthDate]);

  const monthIndexOf = (date: string): number => {
    const prefix = date.slice(0, 7);
    const index = months.findIndex((month) => getMonthKey(month) === prefix);
    return index === -1 ? 0 : index;
  };

  const raw =
    manualDraft?.date === value ? manualDraft.text : formatDateNumeric(value);
  const parsed = isBirthDate ? parseDateNumeric(raw) : '';
  let inputError = '';
  if (isBirthDate && raw.trim()) {
    if (!parsed) inputError = 'Укажите корректную дату в формате ДД.ММ.ГГГГ';
    else if (parsed > lastBirthDate)
      inputError = 'Дата рождения не может быть в будущем';
    else if (min && parsed < min)
      inputError = 'Дата рождения вне доступного диапазона';
  }

  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(inputError);
  }, [inputError]);

  const [monthIndex, setMonthIndex] = useState(() =>
    monthIndexOf(value || todayIso),
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = isBirthDate ? containerRef.current : triggerRef.current;
    if (!isOpen || !panel || !trigger) return;

    const place = () => {
      const gap = 8;
      const inset = 12;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const anchor = trigger.getBoundingClientRect();
      const panelWidth = Math.min(288, width - inset * 2);
      panel.style.width = `${panelWidth}px`;
      const below = top + height - anchor.bottom - gap - inset;
      const above = anchor.top - top - gap - inset;
      panel.style.maxHeight = '';
      const fitsAbove = panel.scrollHeight > below && above > below;
      panel.style.maxHeight = `${Math.max(0, fitsAbove ? above : below)}px`;
      panel.style.top = `${fitsAbove ? anchor.top - gap - panel.offsetHeight : anchor.bottom + gap}px`;
      const aligned =
        popoverAlign === 'left' ? anchor.left : anchor.right - panelWidth;
      panel.style.left = `${Math.max(left + inset, Math.min(aligned, left + width - panelWidth - inset))}px`;
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(panel);
    resize.observe(trigger);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [isOpen, popoverAlign, monthIndex, showTime, isBirthDate]);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus({ preventScroll: true });
  }, [isOpen, showTime]);

  const open = () => {
    const date = value || todayIso;
    const calendarDate =
      isBirthDate && (date < firstBirthDate || date > lastBirthDate)
        ? lastBirthDate
        : date;
    setMonthIndex(monthIndexOf(calendarDate));
    setDraftDate(value);
    setDraftTime(timePicker?.value ?? '');
    setShowTime(false);
    setIsOpen((prev) => !prev);
  };

  const finish = (date: string, time = '') => {
    setManualDraft(undefined);
    setShowInputError(false);
    if (timePicker) timePicker.onChange(date, time);
    else onChange(date);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const display = [
    value ? (timePicker ? formatDateNumeric(value) : formatValue(value)) : '',
    timePicker?.value,
  ]
    .filter(Boolean)
    .join(' ');
  // Индекс мог выйти за границы, если диапазон сузился при открытом поле.
  const month = months[Math.min(monthIndex, months.length - 1)];
  const title = month.title.includes(' ')
    ? month.title
    : `${month.title} ${month.days.find(Boolean)?.date.slice(0, 4)}`;
  const monthKey = getMonthKey(month);
  const year = monthKey.slice(0, 4);
  const yearMonths =
    isBirthDate && isOpen
      ? months.filter((item) => getMonthKey(item).startsWith(year))
      : [];
  const firstYear = Number(firstBirthDate.slice(0, 4));
  const lastYear = Number(lastBirthDate.slice(0, 4));

  return (
    <div ref={containerRef} className="relative">
      {birthDate ? (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete={birthDate.autoComplete}
              aria-label={ariaLabel ?? 'Дата рождения'}
              aria-invalid={Boolean(showInputError && inputError) || undefined}
              aria-describedby={
                showInputError && inputError ? errorId : undefined
              }
              placeholder={inputFocused ? 'ДД.ММ.ГГГГ' : placeholder}
              value={raw}
              required={birthDate.required}
              disabled={disabled}
              onChange={(event) => {
                const input = event.currentTarget;
                const { text, cursor } = maskDateNumericInput(
                  input.value,
                  input.selectionStart ?? input.value.length,
                  (event.nativeEvent as InputEvent).inputType ===
                    'deleteContentForward',
                );
                if (input.value !== text) {
                  input.value = text;
                  input.setSelectionRange(cursor, cursor);
                }
                const iso = parseDateNumeric(text);
                const date =
                  iso <= lastBirthDate && (!min || iso >= min) ? iso : '';
                setManualDraft({ text, date });
                onChange(date);
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => {
                setInputFocused(false);
                setShowInputError(true);
                if (value) setManualDraft(undefined);
              }}
              onInvalid={() => setShowInputError(true)}
              className={`vismuth-input pr-12! ${fieldFillClass(raw)}`}
            />
            <button
              ref={triggerRef}
              type="button"
              onClick={open}
              aria-label="Открыть календарь даты рождения"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              aria-controls={isOpen ? panelId : undefined}
              disabled={disabled}
              className="vismuth-icon-button absolute top-1/2 right-2 -translate-y-1/2"
            >
              <Image src="/calendar.svg" alt="" width={18} height={18} />
            </button>
          </div>
          {showInputError && inputError && (
            <p
              id={errorId}
              className="mt-1 text-xs text-[var(--ui-color-red-600)]"
            >
              {inputError}
            </p>
          )}
        </>
      ) : (
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          disabled={disabled}
          aria-label={ariaLabel}
          data-filled={Boolean(display) || undefined}
          className={`vismuth-input flex w-full cursor-pointer items-center justify-between gap-2 ${fieldFillClass(display)} text-left`}
        >
          <span
            className={
              display
                ? 'text-[var(--ui-color-alabaster-dark-800)]'
                : 'text-[var(--ui-color-alabaster-800)]'
            }
          >
            {display || placeholder}
          </span>
          <Image
            src={timePicker ? '/timeColor.svg' : '/calendar.svg'}
            alt=""
            width={18}
            height={18}
          />
        </button>
      )}

      {isOpen &&
        createPortal(
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-label={timePicker ? 'Выбор даты и времени' : 'Выбор даты'}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="fixed z-[var(--ui-z-popover)] flex flex-col overflow-hidden rounded-[var(--ui-radius-lg)] bg-[var(--ui-color-alabaster-50)] p-3 shadow-[var(--ui-shadow)] outline-none"
          >
            <div className="min-h-0 overflow-y-auto">
              {showTime && timePicker ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="vismuth-function-button text-sm"
                    onClick={() => setShowTime(false)}
                  >
                    {draftDate ? formatDateLabel(draftDate) : 'Выбрать дату'}
                  </button>
                  <input
                    type="time"
                    aria-label="Точное время приёма"
                    value={draftTime}
                    className="vismuth-input"
                    onChange={(event) => setDraftTime(event.target.value)}
                  />
                  <div
                    className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto text-sm"
                    aria-label="Варианты времени"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        aria-pressed={slot === draftTime}
                        className="rounded-lg px-1 py-2 hover:bg-[var(--ui-color-slate-100)] aria-pressed:bg-[var(--ui-color-blue-600)] aria-pressed:text-white"
                        onClick={() => finish(draftDate, slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setMonthIndex((index) => Math.max(0, index - 1))
                      }
                      disabled={monthIndex === 0}
                      aria-label="Предыдущий месяц"
                      className="vismuth-icon-button disabled:cursor-not-allowed"
                    >
                      ‹
                    </button>
                    {birthDate ? (
                      <div className="flex min-w-0 gap-1">
                        <select
                          aria-label="Месяц рождения"
                          className="vismuth-input min-w-0 px-2! text-sm!"
                          value={monthKey}
                          onChange={(event) =>
                            setMonthIndex(monthIndexOf(event.target.value))
                          }
                        >
                          {yearMonths.map((item) => (
                            <option
                              key={getMonthKey(item)}
                              value={getMonthKey(item)}
                            >
                              {item.title.split(' ')[0]}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Год рождения"
                          className="vismuth-input w-auto! px-2! text-sm!"
                          value={year}
                          onChange={(event) => {
                            const target =
                              event.target.value + monthKey.slice(4);
                            const firstMonth = firstBirthDate.slice(0, 7);
                            const lastMonth = lastBirthDate.slice(0, 7);
                            const nextMonth = [
                              firstMonth,
                              target,
                              lastMonth,
                            ].sort()[1];
                            setMonthIndex(monthIndexOf(nextMonth));
                          }}
                        >
                          {Array.from(
                            { length: lastYear - firstYear + 1 },
                            (_, index) => lastYear - index,
                          ).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-[var(--ui-color-alabaster-dark-800)]">
                        {title}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setMonthIndex((index) =>
                          Math.min(months.length - 1, index + 1),
                        )
                      }
                      disabled={monthIndex >= months.length - 1}
                      aria-label="Следующий месяц"
                      className="vismuth-icon-button disabled:cursor-not-allowed"
                    >
                      ›
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--ui-color-alabaster-950)]">
                    {WEEKDAY_LABELS.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>

                  <div
                    className={`mt-1 grid grid-cols-7 text-center text-sm ${timePicker ? 'gap-0.5' : 'gap-1'}`}
                  >
                    {month.days.map((day, index) =>
                      day ? (
                        <button
                          key={day.date}
                          type="button"
                          disabled={day.disabled}
                          onClick={() => {
                            if (timePicker) {
                              setDraftDate(day.date);
                              setShowTime(true);
                            } else finish(day.date);
                          }}
                          aria-pressed={
                            day.date === (timePicker ? draftDate : value)
                          }
                          title={
                            markedDates.includes(day.date)
                              ? 'Есть анкеты'
                              : undefined
                          }
                          className={`relative h-8 cursor-pointer rounded-lg disabled:cursor-not-allowed disabled:text-[var(--ui-color-slate-300)] disabled:hover:bg-transparent ${
                            day.date === (timePicker ? draftDate : value)
                              ? 'bg-[var(--ui-color-blue-600)] text-white'
                              : 'text-[var(--ui-color-alabaster-dark-800)] hover:bg-gray-100'
                          }`}
                        >
                          {day.day}
                          {markedDates.includes(day.date) && (
                            <span
                              aria-label="Есть анкеты"
                              className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white ${day.date < todayIso ? 'bg-[var(--ui-color-slate-400)]' : 'bg-[var(--ui-color-blue-600)]'}`}
                            />
                          )}
                        </button>
                      ) : (
                        <span key={`empty-${index}`} />
                      ),
                    )}
                  </div>
                </>
              )}
            </div>
            {timePicker && (
              <div className="mt-2 flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="vismuth-function-button text-sm"
                  onClick={() => finish('')}
                >
                  Сбросить
                </button>
                {!showTime && (
                  <button
                    type="button"
                    className="vismuth-function-button text-sm"
                    onClick={() => setShowTime(true)}
                  >
                    Выбрать время
                  </button>
                )}
                <button
                  type="button"
                  className="vismuth-button"
                  data-size="xs"
                  onClick={() => finish(draftDate, draftTime)}
                >
                  Готово
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
