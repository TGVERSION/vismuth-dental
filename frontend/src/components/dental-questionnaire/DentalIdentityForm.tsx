'use client';

import { useRef, type FormEvent } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { toDateInputValue } from '@/lib/questionnaire';
import { DentalButton, DentalError } from './DentalShell';

const fields = [
  { key: 'patient.last_name', label: 'Фамилия', autocomplete: 'family-name' },
  { key: 'patient.first_name', label: 'Имя', autocomplete: 'given-name' },
  {
    key: 'patient.middle_name',
    label: 'Отчество (необязательно)',
    autocomplete: 'additional-name',
  },
];

export function DentalIdentityForm({
  step,
  busy,
  error,
  onSubmit,
  renderShell,
}: {
  step: QuestionnaireStep;
  busy: boolean;
  error: string | null;
  onSubmit: (answer: QuestionnaireStepAnswer) => void;
  renderShell: (
    body: React.ReactNode,
    footer: React.ReactNode,
  ) => React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const texts = Object.fromEntries(
      [...fields.map(({ key }) => key), 'about.birth_date'].map((key) => [
        key,
        String(values.get(key) ?? '').trim(),
      ]),
    );
    onSubmit({ step_key: step.step_key, texts });
  };

  return renderShell(
    <form ref={formRef} className="space-y-4" onSubmit={submit}>
      {fields.map(({ key, label, autocomplete }) => (
        <label key={key} className="block space-y-2">
          <span>{label}</span>
          <input
            className="q-field w-full"
            name={key}
            autoComplete={autocomplete}
            required={key !== 'patient.middle_name'}
            maxLength={255}
            disabled={busy}
          />
        </label>
      ))}
      <label className="block space-y-2">
        <span>Дата рождения</span>
        <input
          className="q-field w-full"
          type="date"
          name="about.birth_date"
          autoComplete="bday"
          max={toDateInputValue(new Date())}
          required
          disabled={busy}
        />
      </label>
    </form>,
    <>
      <DentalError message={error} />
      <DentalButton
        onClick={() => formRef.current?.requestSubmit()}
        isBusy={busy}
      >
        Отправить анкету
      </DentalButton>
    </>,
  );
}
