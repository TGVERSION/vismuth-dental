'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import {
  TIME_HOURS,
  TIME_MINUTES,
  splitAppointmentTime,
} from '@/lib/questionnaire';
import { PickerShell } from './PickerShell';

// Колёса предлагают любое время суток: backend принимает любое `HH:MM`
// и списка разрешённых слотов больше не присылает.

interface TimeSheetProps {
  /** `HH:MM` либо пустая строка. */
  value: string;
  onClose: () => void;
  /** Мобильная кнопка «Готово»: применить и закрыть. */
  onApply: (value: string) => void;
  /**
   * Десктоп: выбор применяется сразу, но список не закрывается — время
   * складывается из двух значений, и закрытие после первого клика не дало
   * бы выбрать второе.
   */
  onChange: (value: string) => void;
}

interface TimeDraft {
  hour: string;
  minute: string;
}

interface WheelProps {
  label: string;
  items: readonly string[];
  value: string;
  compact: boolean;
  onChange: (value: string) => void;
}

const Wheel = ({ label, items, value, compact, onChange }: WheelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // При открытии выбранное значение должно быть видно, а не где-то
  // в глубине списка из шестидесяти позиций.
  useEffect(() => {
    const list = listRef.current;
    const selected = selectedRef.current;
    if (!list || !selected) return;

    list.scrollTop =
      selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
    // Только при монтировании: дальше прокруткой управляет пациент.
  }, []);

  return (
    <div className="min-w-0 flex-1">
      <p
        className={`pb-2 text-center text-sm text-[var(--q-muted)] ${
          compact ? 'sticky top-0 bg-white pt-1' : ''
        }`}
      >
        {label}
      </p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        className={`custom-scrollbar-hidden snap-y snap-mandatory overflow-y-auto ${
          compact ? 'h-40' : 'h-56'
        }`}
      >
        {items.map((item) => {
          const selected = item === value;

          return (
            <button
              key={item}
              ref={selected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(item)}
              // Ховер вешается только на невыбранные: у выбранного он
              // перекрыл бы фирменный фон, а светлый текст остался бы —
              // значение становилось нечитаемым под курсором.
              className={`q-select-option flex w-full snap-center items-center justify-center rounded-xl ${
                compact ? 'h-9 text-sm' : 'h-12 text-lg'
              } ${
                selected
                  ? 'bg-[var(--q-brand)] font-medium text-[var(--q-brand-contrast)]'
                  : compact
                    ? 'hover:bg-gray-50'
                    : ''
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const TimeSheet = ({
  value,
  onClose,
  onApply,
  onChange,
}: TimeSheetProps) => {
  const isDesktop = useIsDesktop();
  // Пока время не выбрано, колёса открываются на полудне.
  const [draft, setDraft] = useState<TimeDraft>(() =>
    splitAppointmentTime(value),
  );

  const update = (next: TimeDraft) => {
    setDraft(next);
    if (isDesktop) onChange(`${next.hour}:${next.minute}`);
  };

  return (
    <PickerShell
      title="Время приёма"
      onClose={onClose}
      size="fit"
      footer={
        isDesktop ? undefined : (
          <button
            type="button"
            onClick={() => onApply(`${draft.hour}:${draft.minute}`)}
            className="q-button w-full"
          >
            Готово
          </button>
        )
      }
    >
      <div className={`flex gap-3 pb-2 ${isDesktop ? 'px-3' : 'px-4'}`}>
        <Wheel
          label="Часы"
          items={TIME_HOURS}
          value={draft.hour}
          compact={isDesktop}
          onChange={(hour) => update({ ...draft, hour })}
        />
        <Wheel
          label="Минуты"
          items={TIME_MINUTES}
          value={draft.minute}
          compact={isDesktop}
          onChange={(minute) => update({ ...draft, minute })}
        />
      </div>
    </PickerShell>
  );
};
