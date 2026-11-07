'use client';

import { useId } from 'react';
import {
  toggleGastroChoice,
  type GastroField,
} from '@/lib/gastro-questionnaire';

interface Props {
  field: GastroField;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  error?: string;
  disabled: boolean;
  dateMin?: string | null;
  dateMax?: string | null;
  hideLabel?: boolean;
}

const inputClass = 'q-field w-full outline-none';

export function GastroFieldControl({
  field,
  value,
  onChange,
  error,
  disabled,
  dateMin,
  dateMax,
  hideLabel = false,
}: Props) {
  const id = useId();
  const describedBy =
    [field.help && !hideLabel ? `${id}-help` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined;
  const label = (
    <>
      {field.label}
      {!field.required && !field.label.includes('необязательно') ? (
        <span className="ml-1 text-sm font-normal text-[var(--q-muted)]">
          (необязательно)
        </span>
      ) : null}
    </>
  );
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const textValue = typeof value === 'string' ? value : '';

  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3"
      aria-describedby={describedBy}
    >
      <legend
        className={
          hideLabel ? 'sr-only' : 'mb-2 text-base font-semibold leading-relaxed'
        }
      >
        {label}
      </legend>
      {field.help && !hideLabel ? (
        <p
          id={`${id}-help`}
          className="text-sm leading-relaxed text-[var(--q-muted)]"
        >
          {field.help}
        </p>
      ) : null}
      {field.type === 'single' || field.type === 'multi' ? (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base leading-snug has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--q-brand)] ${selected.includes(option.value) ? 'border-[var(--q-brand)] bg-[var(--q-surface)] font-medium' : 'border-[var(--q-border)] bg-[var(--q-bg)]'}`}
            >
              <input
                type={field.type === 'single' ? 'radio' : 'checkbox'}
                name={`${id}-${field.key}`}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={() =>
                  onChange(toggleGastroChoice(field, selected, option.value))
                }
                className="h-[var(--ui-size-checkbox-m)] w-[var(--ui-size-checkbox-m)] shrink-0 accent-[var(--q-brand)]"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : field.type === 'list' ? (
        <div className="space-y-3">
          {(selected.length ? selected : ['']).map((item, index) => (
            <div key={index} className="space-y-1">
              <label htmlFor={`${id}-${index}`} className="text-sm font-medium">
                Вопрос {index + 1}
              </label>
              <textarea
                id={`${id}-${index}`}
                value={item}
                rows={2}
                placeholder="Напишите свой вопрос"
                className={inputClass}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                onChange={(event) => {
                  const next = selected.length ? [...selected] : [''];
                  next[index] = event.target.value;
                  onChange(next);
                }}
              />
              {selected.length > 1 ? (
                <button
                  type="button"
                  className="min-h-11 px-2 text-sm underline underline-offset-4"
                  onClick={() =>
                    onChange(selected.filter((_, i) => i !== index))
                  }
                  aria-label={`Удалить вопрос ${index + 1}`}
                >
                  Удалить
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            disabled={selected.length >= (field.max_items ?? 30)}
            data-variant="outline"
            className="q-button"
            onClick={() =>
              onChange([...(selected.length ? selected : ['']), ''])
            }
          >
            Добавить вопрос
          </button>
        </div>
      ) : field.type === 'multiline' ? (
        <textarea
          id={id}
          aria-label={field.label}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={hideLabel ? 1 : (field.max_length ?? 1000) > 1000 ? 9 : 3}
          onInput={hideLabel ? (event) => { const element = event.currentTarget; element.style.height = 'auto'; element.style.height = `${Math.min(element.scrollHeight, 144)}px`; } : undefined}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          type={field.type === 'date' ? 'date' : 'text'}
          aria-label={field.label}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          min={field.type === 'date' ? (dateMin ?? undefined) : undefined}
          max={field.type === 'date' ? (dateMax ?? undefined) : undefined}
          autoComplete={
            field.key === 'first_name'
              ? 'given-name'
              : field.key === 'middle_name'
                ? 'additional-name'
                : 'off'
          }
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
      {(field.options ?? [])
        .filter((option) => selected.includes(option.value) && option.warning)
        .map((option) => (
          <p
            key={option.value}
            role="alert"
            className="rounded-xl border border-[var(--ui-color-red-500)] bg-[var(--ui-color-yellow-50)] p-4 text-sm leading-relaxed text-[var(--ui-color-yellow-900)]"
          >
            {option.warning}
          </p>
        ))}
      {field.max_length && field.type !== 'single' && field.type !== 'multi' ? (
        <p className="text-xs text-[var(--q-muted)]">
          {field.type === 'list'
            ? `Необязательно. До ${field.max_items ?? 30} вопросов, каждый до ${field.item_max_length ?? 2000} символов; до ${field.max_length} символов в списке.`
            : `${textValue.length.toLocaleString('ru-RU')} / ${field.max_length.toLocaleString('ru-RU')} символов`}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm font-medium text-[var(--ui-color-red-800)]"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
