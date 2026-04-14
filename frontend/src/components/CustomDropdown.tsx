'use client';

import { useState, useRef, useEffect, ReactNode, KeyboardEvent } from 'react';
import Image from 'next/image';

export type DropdownOption<T = string> = {
  value: T;
  label: string;
  icon?: string;
  badgeClass?: string;
  disabled?: boolean;
  meta?: Record<string, unknown>;
};

export interface CustomDropdownProps<T = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  renderTrigger?: (option: DropdownOption<T>) => ReactNode;
  renderOption?: (option: DropdownOption<T>, isSelected: boolean) => ReactNode;
  showCheckIcon?: boolean;
  position?: 'top' | 'bottom';
  'aria-label'?: string;
}

export function CustomDropdown<T = string>({
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
  showCheckIcon = true,
  position = 'bottom',
  'aria-label': ariaLabel,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const enabledOptions = options.filter((opt) => !opt.disabled);
    const currentIndex = enabledOptions.findIndex((opt) => opt.value === value);

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (enabledOptions.length > 0) {
          const nextIndex = (currentIndex + 1) % enabledOptions.length;
          onChange(enabledOptions[nextIndex].value);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (enabledOptions.length > 0) {
          const prevIndex =
            (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
          onChange(enabledOptions[prevIndex].value);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (option: DropdownOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value);

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
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full h-11 px-3 py-2 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] text-left flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-shadow ${
          isOpen ? 'ring-2 ring-[#5D8CF1]' : ''
        }`}
        aria-controls="dropdown-list"
      >
        {renderTrigger && selectedOption ? (
          renderTrigger(selectedOption)
        ) : (
          <span className="text-sm text-[#202020]">
            {selectedOption?.label || placeholder}
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

      {/* Dropdown List */}
      {isOpen && (
        <div
          ref={listRef}
          id="dropdown-list"
          role="listbox"
          className={`absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-fade-in min-w-[160px] max-h-60 overflow-y-auto ${
            position === 'top' ? 'bottom-full mb-1' : 'top-full'
          } ${dropdownClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const isDisabled = option.disabled;

            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option)}
                disabled={isDisabled}
                className={`w-full cursor-pointer px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected ? 'bg-gray-50' : ''
                } ${optionClassName}`}
              >
                {renderOption ? (
                  renderOption(option, isSelected)
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
                    <span className="text-sm text-[#202020] flex-1">
                      {option.label}
                    </span>
                    {option.badgeClass && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${option.badgeClass}`}
                      >
                        {option.label}
                      </span>
                    )}
                    {showCheckIcon && isSelected && (
                      <Image
                        src="/check.svg"
                        alt="selected"
                        width={16}
                        height={16}
                        className="ml-auto flex-shrink-0"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
