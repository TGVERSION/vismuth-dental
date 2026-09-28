'use client';

import type { ReactNode } from 'react';

export const INPUT_CLASS =
  'h-10 w-full rounded-xl px-3.5 text-sm text-[#202020] outline-none placeholder:text-[#A0A7B0] focus:ring-2 focus:ring-[#5D8CF1] disabled:cursor-not-allowed disabled:text-[#8A9199]';

export const LINK_BUTTON_CLASS =
  'cursor-pointer text-sm text-[#5D8CF1] hover:underline disabled:cursor-not-allowed disabled:opacity-50';

interface FieldRowProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  error?: string | null;
  note?: string | null;
  children: ReactNode;
}

/** Строка формы по макету: подпись слева, поле справа. */
export const FieldRow = ({
  label,
  hint,
  htmlFor,
  error,
  note,
  children,
}: FieldRowProps) => (
  <div className="flex items-start justify-between gap-6 py-3">
    <div className="min-w-0 pt-2.5">
      <label htmlFor={htmlFor} className="block text-base text-[#202020]">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-sm text-[#6C757D]">{hint}</p>}
    </div>
    <div className="w-67.5 shrink-0">
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-[#E53E3E]">
          {error}
        </p>
      ) : (
        note && <p className="mt-1 text-xs text-[#6C757D]">{note}</p>
      )}
    </div>
  </div>
);

export const Spinner = () => (
  <div
    role="status"
    aria-label="Загрузка"
    className="mx-auto my-20 h-10 w-10 animate-spin rounded-full border-b-2 border-[#5D8CF1]"
  />
);

interface ErrorStateProps {
  text: string;
  onRetry: () => void;
}

export const ErrorState = ({ text, onRetry }: ErrorStateProps) => (
  <div className="py-16 text-center">
    <p className="text-[#6C757D]">{text}</p>
    <button
      type="button"
      onClick={onRetry}
      className={`mt-3 ${LINK_BUTTON_CLASS}`}
    >
      Повторить
    </button>
  </div>
);
