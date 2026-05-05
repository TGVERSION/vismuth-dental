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
      className={`flex items-center gap-3 cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all duration-200 ${
            checked
              ? 'border-[#4C7EEA] bg-[#4C7EEA]'
              : 'border-[#F2F4F7] bg-[#F2F4F7] hover:border-[#F2F4F7]'
          }`}
        >
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
                stroke="white"
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
