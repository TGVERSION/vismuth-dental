'use client';

import { useLayoutEffect, useRef } from 'react';
import type { DentalGroup, GroupProblem } from '@/lib/dental-questionnaire';
import { PatientVoiceInput } from '@/components/questionnaire/PatientVoiceInput';
import { DentalCheckbox } from './DentalCheckbox';
import { DentalVisitYearField } from './DentalVisitYearField';

interface Props {
  group: DentalGroup;
  selected: readonly string[];
  text: string;
  showText: boolean;
  problem: GroupProblem | null;
  onToggle: (value: string) => void;
  onText: (text: string) => void;
  disabled: boolean;
}

export const DentalGroupField = ({
  group,
  selected,
  text,
  showText,
  problem,
  onToggle,
  onText,
  disabled,
}: Props) => {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, 144)}px`;
  }, [text, showText]);
  const message =
    problem === 'text' || (problem === 'choose' && group.options.length === 0)
      ? group.options.length === 0
        ? 'Заполните поле'
        : 'Заполните поле «Другое»'
      : null;
  if (group.key === 'about.visit_year')
    return (
      <DentalVisitYearField
        group={group}
        value={text}
        onChange={onText}
        disabled={disabled}
        problem={message}
      />
    );
  const titleId = `q-${group.key}`,
    errorId = `problem-${group.key}`;
  const allergy = group.key.startsWith('allergy.');
  const reason = group.key === 'reason';
  const numeric = group.text?.input_kind && group.text.input_kind !== 'text';
  return (
    <fieldset
      id={`group-${group.key}`}
      disabled={disabled}
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3"
    >
      <h2
        id={titleId}
        className={reason ? 'sr-only' : 'text-base leading-snug font-medium'}
      >
        {group.title && !allergy ? `${group.title}: ` : ''}
        {group.question}
      </h2>
      {group.options.length ? (
        allergy || reason ? (
          <div className="overflow-hidden rounded-2xl bg-white">
            {group.options.map((option) => (
              <div
                key={option.value}
                className="border-t border-[var(--ui-color-alabaster-500)] first:border-t-0"
              >
                <DentalCheckbox
                  checked={selected.includes(option.value)}
                  disabled={disabled}
                  onChange={() => onToggle(option.value)}
                >
                  {option.label}
                </DentalCheckbox>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={selected.includes(option.value)}
                onClick={() => onToggle(option.value)}
                className={`q-choice min-h-[44px] rounded-full border border-[var(--q-brand)] px-4 py-2 text-base ${selected.includes(option.value) ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]' : 'text-[var(--q-brand)]'}`}
              >
                {selected.includes(option.value) ? (
                  <span aria-hidden="true">✓ </span>
                ) : null}
                {option.label}
              </button>
            ))}
          </div>
        )
      ) : null}
      {showText && group.text ? (
        <div className="q-voice-field flex items-center gap-1 rounded-xl bg-[var(--q-surface)]">
          {numeric ? (
            <input
              type="text"
              inputMode={group.text.input_mode ?? 'numeric'}
              disabled={disabled}
              value={text}
              aria-labelledby={titleId}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? errorId : undefined}
              placeholder={group.text.placeholder}
              maxLength={group.text.max_length ?? 20000}
              onChange={(event) => onText(event.target.value)}
              className="q-field w-full"
            />
          ) : (
            <>
              <textarea
                ref={textarea}
                rows={1}
                disabled={disabled}
                value={text}
                aria-labelledby={titleId}
                aria-invalid={Boolean(message)}
                aria-describedby={message ? errorId : undefined}
                placeholder={group.text.placeholder}
                maxLength={group.text.max_length ?? 20000}
                onChange={(event) => onText(event.target.value)}
                className="q-field min-w-0 w-full resize-none py-3"
              />
              <PatientVoiceInput
                value={text}
                onChange={onText}
                disabled={disabled}
                maxLength={group.text.max_length ?? 20000}
                scope={group.key}
              />
            </>
          )}
        </div>
      ) : null}
      {!showText && text ? (
        <p
          aria-label="Ранее сохранённый ответ"
          className="whitespace-pre-wrap text-base text-[var(--q-muted)]"
        >
          {text}
        </p>
      ) : null}
      {message ? (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-[var(--ui-color-red-700)]"
        >
          {message}
        </p>
      ) : null}
    </fieldset>
  );
};
