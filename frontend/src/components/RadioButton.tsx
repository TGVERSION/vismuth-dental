'use client';

import React from 'react';

interface RadioButtonProps {
  id: string;
  name: string;
  checked: boolean;
  onChange: (value: string) => void;
  value?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  id,
  name,
  checked,
  onChange,
  value,
  children,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // Если кликнули по input внутри children — не переключаем радиокнопку
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
          ? 'cursor-not-allowed text-[var(--ui-color-alabaster-800)]'
          : 'cursor-pointer'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <div className="m-[var(--ui-space-2)] h-[var(--ui-size-checkbox-m)] w-[var(--ui-size-checkbox-m)] rounded-[var(--ui-radius-full)] border-2 border-[var(--ui-color-alabaster-600)] bg-[var(--ui-color-alabaster-500)] transition-colors duration-[var(--ui-duration-fast)] group-hover:border-[var(--ui-color-blue-600)] peer-checked:border-[var(--ui-color-blue-600)] peer-checked:bg-[var(--ui-color-blue-600)] group-hover:peer-checked:border-[var(--ui-color-blue-700)] group-hover:peer-checked:bg-[var(--ui-color-blue-700)] peer-focus-visible:shadow-[var(--ui-focus-ring)] peer-disabled:border-[var(--ui-color-alabaster-700)] peer-disabled:bg-[var(--ui-color-alabaster-600)] group-hover:peer-disabled:border-[var(--ui-color-alabaster-700)] group-hover:peer-disabled:bg-[var(--ui-color-alabaster-600)]">
          {checked && (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className={`h-2 w-2 rounded-full ${disabled ? 'bg-[var(--ui-color-alabaster-800)]' : 'bg-[var(--ui-color-alabaster-50)]'}`}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center flex-1">{children}</div>
    </label>
  );
};
