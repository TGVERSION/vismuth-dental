'use client';

import type { ReactNode } from 'react';

export const INPUT_CLASS = 'vismuth-input w-full';

export const LINK_BUTTON_CLASS = 'vismuth-function-button text-sm';

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
  <div className="grid min-w-0 grid-cols-1 items-start gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(210px,270px)] sm:gap-6">
    <div className="min-w-0 pt-[var(--ui-space-10)]">
      <label
        htmlFor={htmlFor}
        className="block text-base text-[var(--ui-color-alabaster-dark-800)]"
      >
        {label}
      </label>
      {hint && (
        <p className="mt-[var(--ui-space-2)] text-sm text-[var(--ui-color-alabaster-950)]">
          {hint}
        </p>
      )}
    </div>
    <div className="min-w-0">
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-[var(--ui-color-red-600)]">
          {error}
        </p>
      ) : (
        note && (
          <p className="mt-1 text-xs text-[var(--ui-color-alabaster-950)]">
            {note}
          </p>
        )
      )}
    </div>
  </div>
);

export const Spinner = () => (
  <div
    role="status"
    aria-label="Загрузка"
    className="mx-auto my-20 h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--ui-color-blue-600)]"
  />
);

interface ErrorStateProps {
  text: string;
  onRetry: () => void;
}

export const ErrorState = ({ text, onRetry }: ErrorStateProps) => (
  <div className="py-16 text-center">
    <p className="text-[var(--ui-color-alabaster-950)]">{text}</p>
    <button
      type="button"
      onClick={onRetry}
      className={`mt-3 ${LINK_BUTTON_CLASS}`}
    >
      Повторить
    </button>
  </div>
);
