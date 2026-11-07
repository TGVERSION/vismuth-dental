'use client';

import React from 'react';

interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked,
  onChange,
  children,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input')) {
      e.stopPropagation();
    }
  };

  return (
    <label
      htmlFor={id}
      onClick={handleContentClick}
      className={`group flex items-center gap-3 text-[length:var(--ui-font-size-15)] ${
        disabled
          ? 'cursor-not-allowed text-[var(--ui-color-alabaster-700)]'
          : 'cursor-pointer'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <div className="m-[var(--ui-space-2)] flex h-[var(--ui-size-checkbox-m)] w-[var(--ui-size-checkbox-m)] items-center justify-center rounded-[var(--ui-radius-xs)] bg-[var(--ui-color-alabaster-500)] text-[var(--ui-color-alabaster-50)] transition-colors duration-[var(--ui-duration-fast)] group-hover:bg-[var(--ui-color-alabaster-600)] peer-checked:bg-[var(--ui-color-blue-600)] group-hover:peer-checked:bg-[var(--ui-color-blue-700)] peer-focus-visible:shadow-[var(--ui-focus-ring)] peer-disabled:bg-[var(--ui-color-alabaster-500)] peer-disabled:text-[var(--ui-color-alabaster-700)] group-hover:peer-disabled:bg-[var(--ui-color-alabaster-500)]">
          {checked && (
            <svg
              width="12"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 5L4.5 8.5L11 1.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="flex items-center flex-1">{children}</div>
    </label>
  );
};
