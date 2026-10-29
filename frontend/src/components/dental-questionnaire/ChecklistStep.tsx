'use client';

import { useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  buildChecklistAnswer,
  parseChecklist,
  toggleChecklist,
} from '@/lib/dental-questionnaire';
import { DentalButton, DentalError } from './DentalShell';

interface ChecklistStepProps {
  step: QuestionnaireStep;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (answer: QuestionnaireStepAnswer) => void;
  renderShell: (body: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
}

/**
 * «Что из этого у вас есть?». Пока ничего не отмечено, внизу одна кнопка
 * «Ничего из этого нет»: здоровый пациент проходит шаг одним нажатием.
 */
export const ChecklistStep = ({
  step,
  isSubmitting,
  error,
  onSubmit,
  renderShell,
}: ChecklistStepProps) => {
  const items = parseChecklist(step);
  const [checked, setChecked] = useState<string[]>([]);

  const body = (
    <>
      <h2 id="health-question" className="text-[23px] leading-tight font-semibold">
        {step.title ?? 'Что из этого у вас есть?'}
      </h2>
      <p className="-mt-3 text-[15px] text-[var(--q-muted)]">
        Отметьте только то, что есть. Остальное считаем «нет».
      </p>
      <ul
        role="group"
        aria-labelledby="health-question"
        className="flex flex-col overflow-hidden rounded-2xl bg-[var(--q-surface)]"
      >
        {items.map((item) => {
          const isOn = checked.includes(item.value);
          return (
            <li key={item.value} className="border-t border-[var(--q-bg)] first:border-t-0">
              <label
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2.5 ${
                  isOn ? 'bg-[color-mix(in_srgb,var(--q-brand)_12%,var(--q-surface))]' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => setChecked((current) => toggleChecklist(current, item.value))}
                  className="h-[22px] w-[22px] shrink-0 accent-[var(--q-brand)]"
                />
                <span className="text-[15px] leading-snug">
                  {item.label}
                  {item.hint ? (
                    <span className="block text-[13px] text-[var(--q-muted)]">{item.hint}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );

  const submit = () => onSubmit(buildChecklistAnswer(step.step_key, checked));
  const footer = (
    <>
      <DentalError message={error} />
      {checked.length === 0 ? (
        <DentalButton variant="soft" onClick={submit} isBusy={isSubmitting}>
          Ничего из этого нет
        </DentalButton>
      ) : (
        <DentalButton onClick={submit} isBusy={isSubmitting}>
          {`Далее · отмечено ${checked.length}`}
        </DentalButton>
      )}
    </>
  );

  return <>{renderShell(body, footer)}</>;
};
