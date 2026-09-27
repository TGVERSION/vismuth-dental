'use client';

import { FIELD_CLASS } from './field-styles';
import { ChevronDownIcon } from './icons';

interface SheetFieldProps {
  /** Выбранное значение. Пусто — показываем подсказку приглушённым цветом. */
  value: string;
  placeholder: string;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
  /** Иконка справа. По умолчанию — шеврон выпадающего списка. */
  icon?: React.ReactNode;
}

/**
 * Поле, которое открывает шторку выбора. Выглядит как обычное поле ввода,
 * чтобы форма не распадалась на разные по виду элементы.
 */
export const SheetField = ({
  value,
  placeholder,
  ariaLabel,
  onClick,
  className = '',
  icon,
}: SheetFieldProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-haspopup="dialog"
    className={`${FIELD_CLASS} flex items-center justify-between gap-2 text-left ${className}`}
  >
    <span className={`truncate ${value ? '' : 'text-[var(--q-muted)]'}`}>
      {value || placeholder}
    </span>
    <span className="shrink-0 text-[var(--q-muted)]">
      {icon ?? <ChevronDownIcon className="h-5 w-5" />}
    </span>
  </button>
);
