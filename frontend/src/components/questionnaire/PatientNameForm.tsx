'use client';

import { useState } from 'react';
import {
  PATIENT_NAME_MAX_LENGTH,
  isValidPatientName,
} from '@/lib/questionnaire';
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
      <h1 className="text-[length:var(--ui-font-size-26)] font-bold">
        Как вас зовут?
      </h1>

      <input
        type="text"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        autoComplete="given-name"
        maxLength={PATIENT_NAME_MAX_LENGTH}
        placeholder="Имя*"
        aria-label="Имя"
        aria-required="true"
        aria-invalid={touched && !nameValid}
        className={`${FIELD_CLASS} mt-6 w-full`}
      />
      {touched && !nameValid ? (
        <p role="alert" className="mt-1 text-sm text-[var(--ui-color-red-700)]">
          Укажите имя
        </p>
      ) : null}

      <input
        type="text"
        value={middleName}
        onChange={(event) => setMiddleName(event.target.value)}
        autoComplete="additional-name"
        maxLength={PATIENT_NAME_MAX_LENGTH}
        placeholder="Отчество"
        aria-label="Отчество"
        className={`${FIELD_CLASS} mt-3 w-full`}
      />

      <div className="mt-auto pb-[calc(env(safe-area-inset-bottom)+16px)] pt-8">
        <button type="submit" className="q-button w-full">
          Продолжить
        </button>
      </div>
    </form>
  );
};
