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
}

const inputClass = 'min-h-12 w-full rounded-xl border border-[var(--q-border)] bg-[var(--q-surface)] px-4 py-3 text-base leading-relaxed text-[var(--q-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-brand)] disabled:opacity-60';

export function GastroFieldControl({ field, value, onChange, error, disabled, dateMin, dateMax }: Props) {
  const id = useId();
  const describedBy = [field.help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const label = <>{field.label}{!field.required && !field.label.includes('необязательно') ? <span className="ml-1 text-sm font-normal text-[var(--q-muted)]">(необязательно)</span> : null}</>;
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const textValue = typeof value === 'string' ? value : '';

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3" aria-describedby={describedBy}>
      <legend className="mb-2 text-base font-semibold leading-relaxed">{label}</legend>
      {field.help ? <p id={`${id}-help`} className="text-sm leading-relaxed text-[var(--q-muted)]">{field.help}</p> : null}
      {field.type === 'single' || field.type === 'multi' ? (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <label key={option.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base leading-snug has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--q-brand)] ${selected.includes(option.value) ? 'border-[var(--q-brand)] bg-[var(--q-surface)] font-medium' : 'border-[var(--q-border)] bg-[var(--q-bg)]'}`}>
              <input type={field.type === 'single' ? 'radio' : 'checkbox'}
                name={`${id}-${field.key}`} value={option.value}
                checked={selected.includes(option.value)}
                onChange={() => onChange(toggleGastroChoice(field, selected, option.value))}
                className="h-4 w-4 shrink-0 accent-[var(--q-brand)]" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : field.type === 'list' ? (
        <div className="space-y-3">
          {(selected.length ? selected : ['']).map((item, index) => (
            <div key={index} className="space-y-1">
              <label htmlFor={`${id}-${index}`} className="text-sm font-medium">Вопрос {index + 1}</label>
              <textarea id={`${id}-${index}`} value={item} rows={2}
                placeholder="Напишите свой вопрос" className={inputClass}
                aria-invalid={Boolean(error)} aria-describedby={describedBy}
                onChange={(event) => {
                  const next = selected.length ? [...selected] : [''];
                  next[index] = event.target.value;
                  onChange(next);
                }} />
              {selected.length > 1 ? <button type="button" className="min-h-11 px-2 text-sm underline underline-offset-4"
                onClick={() => onChange(selected.filter((_, i) => i !== index))}
                aria-label={`Удалить вопрос ${index + 1}`}>Удалить</button> : null}
            </div>
          ))}
          <button type="button" disabled={selected.length >= (field.max_items ?? 30)} className="min-h-12 rounded-xl border border-[var(--q-border)] px-4 py-2 text-base font-medium disabled:opacity-50"
            onClick={() => onChange([...(selected.length ? selected : ['']), ''])}>Добавить вопрос</button>
        </div>
      ) : field.type === 'multiline' ? (
        <textarea id={id} aria-label={field.label} aria-invalid={Boolean(error)} aria-describedby={describedBy}
          value={textValue} onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder} rows={(field.max_length ?? 1000) > 1000 ? 9 : 3}
          className={inputClass} />
      ) : (
        <input id={id} type={field.type === 'date' ? 'date' : 'text'} aria-label={field.label}
          aria-invalid={Boolean(error)} aria-describedby={describedBy}
          value={textValue} onChange={(event) => onChange(event.target.value)}
          min={field.type === 'date' ? dateMin ?? undefined : undefined}
          max={field.type === 'date' ? dateMax ?? undefined : undefined}
          autoComplete={field.key === 'first_name' ? 'given-name' : field.key === 'middle_name' ? 'additional-name' : 'off'}
          placeholder={field.placeholder} className={inputClass} />
      )}
      {(field.options ?? []).filter((option) => selected.includes(option.value) && option.warning).map((option) => (
        <p key={option.value} role="alert" className="rounded-xl border border-[#C46A36] bg-[#FFF6EC] p-4 text-sm leading-relaxed text-[#713B1C]">{option.warning}</p>
      ))}
      {field.max_length && field.type !== 'single' && field.type !== 'multi' ? (
        <p className="text-xs text-[var(--q-muted)]">{field.type === 'list'
          ? `Необязательно. До ${field.max_items ?? 30} вопросов, каждый до ${field.item_max_length ?? 2000} символов; до ${field.max_length} символов в списке.`
          : `${textValue.length.toLocaleString('ru-RU')} / ${field.max_length.toLocaleString('ru-RU')} символов`}</p>
      ) : null}
      {error ? <p id={`${id}-error`} role="alert" className="text-sm font-medium text-[#A33132]">{error}</p> : null}
    </fieldset>
  );
}
