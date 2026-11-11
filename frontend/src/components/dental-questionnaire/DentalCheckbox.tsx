'use client';

interface Props {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  children: React.ReactNode;
}

/** Геометрия и состояния VISMUTH, цвет основной кнопки анкеты. */
export const DentalCheckbox = ({
  checked,
  disabled,
  onChange,
  children,
}: Props) => (
  <label className="group flex min-h-[var(--ui-size-btn-m)] min-w-0 cursor-pointer items-center gap-3 bg-white px-4 py-3 has-[:disabled]:cursor-not-allowed">
    <span className="relative flex shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="m-[var(--ui-space-2)] flex h-[var(--ui-size-checkbox-m)] w-[var(--ui-size-checkbox-m)] items-center justify-center rounded-[var(--ui-radius-xs)] bg-[var(--ui-color-alabaster-500)] text-[var(--q-brand-contrast)] transition-colors duration-[var(--ui-duration-fast)] group-hover:bg-[var(--ui-color-alabaster-600)] peer-checked:bg-[var(--q-brand)] group-hover:peer-checked:bg-[var(--q-brand)] peer-focus-visible:shadow-[var(--ui-focus-ring)] peer-disabled:bg-[var(--ui-color-alabaster-500)] peer-disabled:text-[var(--ui-color-alabaster-700)] group-hover:peer-disabled:bg-[var(--ui-color-alabaster-500)]"
      >
        {checked ? (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path
              d="M1 5L4.5 8.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
    </span>
    <span className="min-w-0 flex-1 text-base leading-snug">{children}</span>
  </label>
);
