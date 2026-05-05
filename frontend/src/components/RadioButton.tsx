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
      className={`flex items-center gap-3 cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
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
          className="sr-only"
        />
        <div
          className={`w-5.5 h-5.5 rounded-full border-2 transition-all duration-200 ${
            checked
              ? 'border-[#F2F4F7] bg-[#F2F4F7]'
              : 'border-[#F2F4F7] bg-[#F2F4F7] hover:border-[#F2F4F7]'
          }`}
        >
          {checked && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-2.75 h-2.75 rounded-full bg-[#4C7EEA]" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center flex-1">{children}</div>
    </label>
  );
};
