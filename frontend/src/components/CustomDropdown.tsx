'use client';

import {
  useState,
  useRef,
  useEffect,
  useId,
  ReactNode,
  KeyboardEvent,
} from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';

export type DropdownOption<T = string> = {
  value: T;
  label: string;
  icon?: string;
  badgeClass?: string;
  disabled?: boolean;
  meta?: Record<string, unknown>;
};

// Условные типы для value и onChange в зависимости от multiple
export type DropdownValue<T, M extends boolean = false> = M extends true
  ? T[]
  : T;
export type DropdownOnChange<T, M extends boolean = false> = (
  value: DropdownValue<T, M>,
) => void;

export interface CustomDropdownProps<T = string, M extends boolean = false> {
  options: DropdownOption<T>[];
  value: DropdownValue<T, M>;
  onChange: DropdownOnChange<T, M>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Дополнительный фон/размер кнопки; общий вид списка остаётся единым. */
  triggerClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  renderTrigger?: (
    option: DropdownOption<T> | DropdownOption<T>[],
  ) => ReactNode;
  renderOption?: (option: DropdownOption<T>, isSelected: boolean) => ReactNode;
  showCheckIcon?: boolean;
  position?: 'top' | 'bottom';
  multiple?: M;
  'aria-label'?: string;
  onSearch?: (query: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function CustomDropdown<T = string, M extends boolean = false>({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  disabled = false,
  className = '',
  triggerClassName = 'bg-[var(--ui-color-alabaster-100)]',
  dropdownClassName = '',
  optionClassName = '',
  renderTrigger,
  renderOption,
  showCheckIcon = false,
  position = 'bottom',
  multiple = false as M,
  'aria-label': ariaLabel,
  onSearch,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: CustomDropdownProps<T, M>) {
  const [isOpen, setIsOpen] = useState(false);
  // Уникальный id списка: на экране протокола таких дропдаунов много,
  // общий литерал давал дубли id в DOM и ломал связь aria-controls.
  const listboxId = useId();
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Хелперы для работы с одиночным и множественным выбором
  const getValues = (): T[] => {
    if (multiple) {
      return Array.isArray(value)
        ? (value as T[])
        : value == null
          ? []
          : [value as T];
    }
    return value == null ? [] : [value as T];
  };

  const isSelected = (optionValue: T): boolean => {
    return getValues().includes(optionValue);
  };

  const handleValueChange = (optionValue: T) => {
    if (disabled) return;
    if (multiple) {
      const currentValues = getValues();
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      (onChange as DropdownOnChange<T, true>)(
        newValues as DropdownValue<T, true>,
      );
    } else {
      (onChange as DropdownOnChange<T, false>)(
        optionValue as DropdownValue<T, false>,
      );
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    bottom?: number;
    maxHeight?: number;
  }>({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const gap = 4;

      let preferred: 'top' | 'bottom';
      if (position === 'top') {
        preferred = spaceAbove >= 200 ? 'top' : 'bottom';
      } else {
        preferred = spaceBelow >= 200 ? 'bottom' : 'top';
      }

      if (preferred === 'top' && spaceAbove < 200 && spaceBelow > spaceAbove) {
        preferred = 'bottom';
      } else if (
        preferred === 'bottom' &&
        spaceBelow < 200 &&
        spaceAbove > spaceBelow
      ) {
        preferred = 'top';
      }

      let top: number | undefined;
      let bottom: number | undefined;
      let maxHeight: number | undefined;

      if (preferred === 'top') {
        bottom = viewportHeight - rect.top + gap;
        maxHeight = Math.max(0, Math.min(spaceAbove - gap * 2, 240));
        top = undefined;
      } else {
        top = rect.bottom + gap;
        maxHeight = Math.max(0, Math.min(spaceBelow - gap * 2, 240));
        bottom = undefined;
      }

      const width = Math.min(rect.width, window.innerWidth - gap * 4);
      setCoords({
        top: top ?? 0,
        left: Math.max(
          gap * 2,
          Math.min(rect.left, window.innerWidth - width - gap * 2),
        ),
        width,
        bottom,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, position]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    // События портального списка всплывают через React к полю. Не подавляем
    // Enter/Space у option-button: его обычный click должен выбрать вариант.
    const option = (e.target as HTMLElement).closest('[role="option"]');
    if (option) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        containerRef.current?.querySelector('button')?.focus();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const buttons = Array.from(
          listRef.current?.querySelectorAll<HTMLButtonElement>(
            'button[role="option"]:not(:disabled)',
          ) ?? [],
        );
        if (e.key === 'Home' || e.key === 'End') {
          buttons[e.key === 'Home' ? 0 : buttons.length - 1]?.focus();
          return;
        }
        const index = buttons.indexOf(option as HTMLButtonElement);
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        buttons[(index + direction + buttons.length) % buttons.length]?.focus();
      }
      return;
    }
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]:not(:disabled)',
      ) ?? [],
    );
    const currentIndex = buttons.findIndex(
      (button) => button.getAttribute('aria-selected') === 'true',
    );

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        buttons[(currentIndex + 1) % buttons.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        buttons[
          (currentIndex < 0
            ? buttons.length - 1
            : currentIndex - 1 + buttons.length) % buttons.length
        ]?.focus();
        break;
      case 'Home':
      case 'End':
        e.preventDefault();
        buttons[e.key === 'Home' ? 0 : buttons.length - 1]?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!multiple) {
          setIsOpen(false);
        }
        break;
    }
  };

  useEffect(() => {
    if (isOpen && onSearch) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen, onSearch]);

  const sortedOptions = onSearch
    ? options
    : [...options].sort((a, b) => {
        const aSelected = isSelected(a.value);
        const bSelected = isSelected(b.value);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });

  const selectedOptions = options.filter((opt) => isSelected(opt.value));

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onLoadMore || !hasMore || isLoading) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      onLoadMore();
    }
  };

  const dropdownList = (
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: coords.bottom !== undefined ? 'auto' : coords.top,
        bottom: coords.bottom ?? 'auto',
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight ?? 240,
        zIndex: 'var(--ui-z-popover)',
      }}
      className={`bg-[var(--ui-color-alabaster-50)] rounded-[var(--ui-radius-lg)] shadow-[var(--ui-shadow)] p-[var(--ui-space-6)] overflow-hidden animate-fade-in flex flex-col ${dropdownClassName}`}
    >
      {onSearch && (
        <div className="p-2 border-b border-gray-100 shrink-0">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder="Поиск..."
            className="vismuth-input w-full text-sm"
            aria-label="Поиск вариантов"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setIsOpen(false);
                containerRef.current?.focus();
              }
            }}
          />
        </div>
      )}
      <div
        role="listbox"
        id={listboxId}
        aria-label={ariaLabel}
        aria-multiselectable={multiple}
        className="overflow-y-auto"
        onScroll={handleListScroll}
      >
        {sortedOptions.map((option) => {
          const optionIsSelected = isSelected(option.value);
          const isDisabled = option.disabled;

          return (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={optionIsSelected}
              onClick={() => handleValueChange(option.value)}
              disabled={disabled || isDisabled}
              className={`w-full cursor-pointer min-h-[var(--ui-size-control-l)] rounded-[var(--ui-radius-sm)] px-[var(--ui-space-10)] py-[var(--ui-space-6)] text-left flex items-center gap-2 hover:bg-[var(--ui-color-alabaster-500)] hover:text-[var(--ui-color-alabaster-dark-800)] focus-visible:shadow-[var(--ui-focus-ring)] focus-visible:outline-none transition-colors disabled:bg-transparent disabled:text-[var(--ui-color-alabaster-700)] disabled:cursor-not-allowed ${
                optionIsSelected
                  ? 'bg-[var(--ui-color-blue-100)] text-[var(--ui-color-blue-600)]'
                  : 'text-[var(--ui-color-alabaster-dark-800)]'
              } ${optionClassName}`}
            >
              <div className="flex-1 flex items-center gap-3">
                {renderOption ? (
                  renderOption(option, optionIsSelected)
                ) : (
                  <>
                    {option.icon && (
                      <Image
                        src={option.icon}
                        alt=""
                        width={16}
                        height={16}
                        className="shrink-0"
                      />
                    )}
                    <span className="text-sm">{option.label}</span>
                    {option.badgeClass && (
                      <span
                        className={`text-xs px-2 py-[var(--ui-space-2)] rounded-full ${option.badgeClass}`}
                      >
                        {option.label}
                      </span>
                    )}
                  </>
                )}
              </div>

              {showCheckIcon && optionIsSelected && (
                <Image
                  src="/check.svg"
                  alt="selected"
                  width={16}
                  height={16}
                  className="shrink-0 ml-auto"
                />
              )}
            </button>
          );
        })}
        {isLoading && (
          <div className="px-4 py-3 text-center text-sm text-[var(--ui-color-alabaster-950)]">
            Загрузка...
          </div>
        )}
        {!isLoading && options.length === 0 && (
          <div className="px-4 py-3 text-center text-sm text-[var(--ui-color-alabaster-950)]">
            Ничего не найдено
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      aria-controls={listboxId}
      aria-expanded={isOpen && !disabled}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        data-filled={selectedOptions.length > 0 || undefined}
        className={`vismuth-input w-full gap-3 ${triggerClassName} text-left flex items-center justify-between cursor-pointer disabled:cursor-not-allowed transition-shadow ${
          isOpen && !disabled ? 'shadow-[var(--ui-focus-ring)]' : ''
        }`}
        aria-controls={listboxId}
      >
        {renderTrigger && selectedOptions.length > 0 ? (
          renderTrigger(multiple ? selectedOptions : selectedOptions[0])
        ) : (
          <span className="min-w-0 truncate">
            {multiple && selectedOptions.length > 0
              ? selectedOptions.map((opt) => opt.label).join(', ')
              : selectedOptions[0]?.label || placeholder}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{
            color: disabled
              ? 'var(--ui-color-alabaster-700)'
              : 'var(--ui-color-alabaster-950)',
          }}
          width={24}
          height={24}
          className={`transition-transform duration-200 shrink-0 ${
            isOpen && !disabled ? 'rotate-180' : ''
          }`}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.4691 15.5339L6.5297 10.5936C6.23096 10.2948 6.21791 9.81458 6.5 9.5C6.81291 9.2197 7.29033 9.23284 7.58735 9.52992L11.9994 13.9429L16.4107 9.53076C16.7135 9.22789 17.1966 9.19773 17.5 9.5C17.8048 9.80369 17.7737 10.2891 17.4694 10.5934L12.5298 15.5339C12.3892 15.6746 12.1984 15.7537 11.9994 15.7537C11.8005 15.7537 11.6097 15.6746 11.4691 15.5339Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {isOpen && !disabled && createPortal(dropdownList, document.body)}
    </div>
  );
}
