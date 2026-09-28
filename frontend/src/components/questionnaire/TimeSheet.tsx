'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { slotHours, slotMinutes } from '@/lib/questionnaire';
import { PickerShell } from './PickerShell';

interface TimeSheetProps {
  /**
   * Разрешённое время `HH:MM` из шага сервера. Колёса предлагают только его:
   * любое другое время backend отклонит.
   */
  slots: string[];
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

/**
 * Начальное значение: выбранное время, если оно среди слотов, иначе первый
 * слот — полдень мог бы и не входить в расписание клиники.
 */
const initialDraft = (slots: string[], value: string): TimeDraft => {
  const [hour = '', minute = ''] = value.split(':');
  if (slotMinutes(slots, hour).includes(minute)) return { hour, minute };

  const firstHour = slotHours(slots)[0] ?? '';
  return { hour: firstHour, minute: slotMinutes(slots, firstHour)[0] ?? '' };
};

interface WheelProps {
  label: string;
  items: string[];
  value: string;
  compact: boolean;
  onChange: (value: string) => void;
}

const Wheel = ({ label, items, value, compact, onChange }: WheelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // При открытии выбранное значение должно быть видно, а не где-то
  // в глубине списка.
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
              className={`flex w-full snap-center items-center justify-center rounded-xl ${
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
  slots,
  value,
  onClose,
  onApply,
  onChange,
}: TimeSheetProps) => {
  const isDesktop = useIsDesktop();
  const [draft, setDraft] = useState(() => initialDraft(slots, value));

  const hours = slotHours(slots);
  const minutes = slotMinutes(slots, draft.hour);

  const update = (next: TimeDraft) => {
    setDraft(next);
    if (isDesktop) onChange(`${next.hour}:${next.minute}`);
  };

  // При смене часа минута остаётся, если она есть в новом часе, иначе
  // подбирается первая доступная: 18:30 в расписании может не быть.
  const changeHour = (hour: string) => {
    const available = slotMinutes(slots, hour);
    update({
      hour,
      minute: available.includes(draft.minute)
        ? draft.minute
        : (available[0] ?? ''),
    });
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
            className="min-h-[52px] w-full rounded-xl bg-[var(--q-brand)] px-4 text-base font-medium text-[var(--q-brand-contrast)]"
          >
            Готово
          </button>
        )
      }
    >
      <div className={`flex gap-3 pb-2 ${isDesktop ? 'px-3' : 'px-4'}`}>
        <Wheel
          label="Часы"
          items={hours}
          value={draft.hour}
          compact={isDesktop}
          onChange={changeHour}
        />
        <Wheel
          label="Минуты"
          items={minutes}
          value={draft.minute}
          compact={isDesktop}
          onChange={(minute) => update({ ...draft, minute })}
        />
      </div>
    </PickerShell>
  );
};
