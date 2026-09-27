'use client';

import { useState } from 'react';
import { isValidPatientName } from '@/lib/questionnaire';
import { FIELD_CLASS } from './field-styles';

interface PatientNameFormProps {
  firstName: string;
  middleName: string;
  onSubmit: (data: { firstName: string; middleName: string }) => void;
}

/**
 * Имя и отчество — отдельный шаг.
 *
 * Отчество не обязательно: оно есть не у всех, а обязательность так и не
 * подтверждена смежниками (ВЗ-5).
 */
export const PatientNameForm = ({
  firstName: initialFirstName,
  middleName: initialMiddleName,
  onSubmit,
}: PatientNameFormProps) => {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [middleName, setMiddleName] = useState(initialMiddleName);
  const [touched, setTouched] = useState(false);

  const nameValid = isValidPatientName(firstName);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!nameValid) return;

        onSubmit({
          firstName: firstName.trim(),
          middleName: middleName.trim(),
        });
      }}
      className="q-screen flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+24px)]"
    >
      <h1 className="text-2xl font-semibold">Как вас зовут?</h1>

      <input
        type="text"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        autoComplete="given-name"
        placeholder="Имя*"
        aria-label="Имя"
        aria-required="true"
        className={`${FIELD_CLASS} mt-6 min-h-[52px] w-full`}
      />
      {touched && !nameValid ? (
        <p role="alert" className="mt-1 text-sm text-[#C2334D]">
          Укажите имя
        </p>
      ) : null}

      <input
        type="text"
        value={middleName}
        onChange={(event) => setMiddleName(event.target.value)}
        autoComplete="additional-name"
        placeholder="Отчество"
        aria-label="Отчество"
        className={`${FIELD_CLASS} mt-3 min-h-[52px] w-full`}
      />

      <div className="mt-auto pb-[calc(env(safe-area-inset-bottom)+16px)] pt-8">
        <button
          type="submit"
          className="min-h-[52px] w-full rounded-xl bg-[var(--q-brand)] px-4 text-base font-medium text-[var(--q-brand-contrast)]"
        >
          Продолжить
        </button>
      </div>
    </form>
  );
};
