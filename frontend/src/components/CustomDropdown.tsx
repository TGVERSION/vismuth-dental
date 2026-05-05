'use client';

import { useState, useRef, useEffect, ReactNode, KeyboardEvent } from 'react';
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
  dropdownClassName?: string;
  optionClassName?: string;
  // Исправленная строка:
  renderTrigger?: (
    option: DropdownOption<T> | DropdownOption<T>[],
  ) => ReactNode;
  renderOption?: (option: DropdownOption<T>, isSelected: boolean) => ReactNode;
  showCheckIcon?: boolean;
  position?: 'top' | 'bottom';
  multiple?: M;
  'aria-label'?: string;
}

export function CustomDropdown<T = string, M extends boolean = false>({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  disabled = false,
  className = '',
  dropdownClassName = '',
  optionClassName = '',
  renderTrigger,
  renderOption,
  showCheckIcon = false,
  position = 'bottom',
  multiple = false as M,
  'aria-label': ariaLabel,
}: CustomDropdownProps<T, M>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Хелперы для работы с одиночным и множественным выбором
  const getValues = (): T[] => {
    if (multiple) {
      return Array.isArray(value) ? (value as T[]) : value ? [value as T] : [];
    }
    return value ? [value as T] : [];
  };

  const isSelected = (optionValue: T): boolean => {
    return getValues().includes(optionValue);
  };

  const handleValueChange = (optionValue: T) => {
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

  // Координаты и адаптивное направление
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    bottom?: number;
    maxHeight?: number;
  }>({ top: 0, left: 0, width: 0 });
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom'>(
    position,
  );

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
        maxHeight = Math.min(spaceAbove - gap * 2, 240);
        top = undefined;
      } else {
        top = rect.bottom + gap;
        maxHeight = Math.min(spaceBelow - gap * 2, 240);
        bottom = undefined;
      }

      setActualPosition(preferred);
      setCoords({
        top: top ?? 0,
        left: rect.left,
        width: rect.width,
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
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const enabledOptions = options.filter((opt) => !opt.disabled);
    const currentValues = getValues();
    const currentIndex = enabledOptions.findIndex((opt) =>
      currentValues.includes(opt.value),
    );

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (enabledOptions.length > 0) {
          const nextIndex = (currentIndex + 1) % enabledOptions.length;
          handleValueChange(enabledOptions[nextIndex].value);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (enabledOptions.length > 0) {
          const prevIndex =
            (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
          handleValueChange(enabledOptions[prevIndex].value);
        }
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

  const sortedOptions = [...options].sort((a, b) => {
    const aSelected = isSelected(a.value);
    const bSelected = isSelected(b.value);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const selectedOptions = options.filter((opt) => isSelected(opt.value));

  const dropdownList = (
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: coords.bottom ? 'auto' : coords.top,
        bottom: coords.bottom ?? 'auto',
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight ?? 240,
        zIndex: 9999,
      }}
      id="dropdown-list"
      role="listbox"
      aria-multiselectable={multiple}
      className={`bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-fade-in max-h-60 overflow-y-auto ${
        dropdownClassName
      }`}
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
            disabled={isDisabled}
            className={`w-full cursor-pointer px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              optionIsSelected ? 'bg-gray-50' : ''
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
                      className="flex-shrink-0"
                    />
                  )}
                  <span className="text-sm text-[#202020]">{option.label}</span>
                  {option.badgeClass && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${option.badgeClass}`}
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
                className="flex-shrink-0 ml-auto"
              />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full min-h-11 px-3 py-2 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] text-left flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-shadow ${
          isOpen ? 'ring-2 ring-[#5D8CF1]' : ''
        }`}
        aria-controls="dropdown-list"
      >
        {renderTrigger && selectedOptions.length > 0 ? (
          renderTrigger(multiple ? selectedOptions : selectedOptions[0])
        ) : (
          <span className="text-sm text-[#202020] truncate">
            {multiple && selectedOptions.length > 0
              ? selectedOptions.map((opt) => opt.label).join(', ')
              : selectedOptions[0]?.label || placeholder}
          </span>
        )}
        <Image
          src="/arrow-dropdown.svg"
          alt="toggle"
          width={10}
          height={10}
          className={`transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && createPortal(dropdownList, document.body)}
    </div>
  );
}
