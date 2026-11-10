'use client';

import { useRef, useState } from 'react';
import type { DentalGroup } from '@/lib/dental-questionnaire';

interface Props {
  group: DentalGroup;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  problem: string | null;
}

/** Год хранится прежним текстовым ответом; выбор кнопки не отправляет раздел. */
export const DentalVisitYearField = ({
  group,
  value,
  onChange,
  disabled,
  problem,
}: Props) => {
  const currentYear =
    Number(
      group.text?.quick_choices?.find((choice) => /^\d{4}$/.test(choice)),
    ) || new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) =>
    String(currentYear - index),
  );
  const [other, setOther] = useState(Boolean(value && !years.includes(value)));
  const showOther = other || Boolean(value && !years.includes(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const questionId = `q-${group.key}`;
  return (
    <fieldset
      id={`group-${group.key}`}
      disabled={disabled}
      aria-labelledby={questionId}
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id={questionId} className="text-base leading-snug font-medium">
        Год последнего посещения стоматолога
      </h2>
      <div className="flex flex-wrap gap-2">
        {years.map((year) => (
          <button
            key={year}
            type="button"
            disabled={disabled}
            aria-pressed={!showOther && value === year}
            onClick={() => {
              setOther(false);
              onChange(year);
            }}
            className={`q-choice min-h-[44px] rounded-full border border-[var(--q-brand)] px-4 text-base ${!showOther && value === year ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]' : 'text-[var(--q-brand)]'}`}
          >
            {year}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={showOther}
          aria-expanded={showOther}
          aria-controls="dental-other-visit-year"
          onClick={() => {
            setOther(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={`q-choice min-h-[44px] rounded-full border border-[var(--q-brand)] px-4 text-base ${showOther ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]' : 'text-[var(--q-brand)]'}`}
        >
          Другой год
        </button>
      </div>
      {showOther ? (
        <label className="flex flex-col gap-2 text-base">
          Укажите год
          <input
            ref={inputRef}
            id="dental-other-visit-year"
            type="text"
            inputMode="text"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            maxLength={group.text?.max_length ?? 20000}
            placeholder="Например: 2018"
            aria-invalid={Boolean(problem)}
            aria-describedby={problem ? 'dental-visit-year-error' : undefined}
            className="q-field w-full"
          />
        </label>
      ) : null}
      {problem ? (
        <p
          id="dental-visit-year-error"
          role="alert"
          className="text-sm text-[var(--ui-color-red-700)]"
        >
          {problem}
        </p>
      ) : null}
    </fieldset>
  );
};
