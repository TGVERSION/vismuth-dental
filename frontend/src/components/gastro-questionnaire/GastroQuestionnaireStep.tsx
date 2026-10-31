'use client';

import { useRef, useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  buildGastroAnswer, gastroMeta, isGastroFieldVisible, validateGastroFields,
  type GastroValues,
} from '@/lib/gastro-questionnaire';
import { GastroFieldControl } from './GastroFieldControl';

interface Props {
  step: QuestionnaireStep;
  submit: (answer: QuestionnaireStepAnswer) => Promise<QuestionnaireStep | null>;
  isSubmitting: boolean;
  submitError: string | null;
  clinicPhone?: string | null;
}

export function GastroQuestionnaireStep({ step, submit, isSubmitting, submitError, clinicPhone }: Props) {
  const meta = gastroMeta(step);
  const [values, setValues] = useState<GastroValues>(() => meta?.values ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);

  if (!meta) return (
    <div role="alert" className="q-screen px-5 py-10">
      <h1 className="text-xl font-semibold">Не удалось показать вопрос</h1>
      <p className="mt-3">Обновите страницу. Уже отправленные ответы сохранены.</p>
      {clinicPhone ? <a className="mt-5 inline-block min-h-12 underline" href={`tel:${clinicPhone}`}>Связаться с клиникой</a> : null}
    </div>
  );

  const send = (action?: string) => {
    if (isSubmitting) return;
    if (!action || action === 'continue') {
      const issues = validateGastroFields(meta.fields, values);
      setErrors(issues);
      if (Object.keys(issues).length) {
        requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
      const answer = buildGastroAnswer(step, values);
      if (action) answer.choice = action;
      void submit(answer);
    } else {
      void submit(buildGastroAnswer(step, values, action));
    }
  };
  const defaultLabel = meta.screen === 'questions' ? 'Отправить анкету'
    : meta.screen === 'review' ? 'Продолжить к вопросам врачу' : 'Продолжить';
  const actions = meta.actions.length ? meta.actions : meta.screen === 'ai_wait'
    ? [{ value: 'finish_ai', label: 'Закончить без уточнений', primary: true }]
    : [{ value: 'continue', label: defaultLabel, primary: true }];

  return (
    <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); send('continue'); }}
      className="q-screen mx-auto flex w-full max-w-2xl flex-col px-4 pb-8 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        {meta.can_back ? <button type="button" disabled={isSubmitting} onClick={() => send('back')}
          className="min-h-12 rounded-lg px-2 text-sm font-medium underline underline-offset-4 disabled:opacity-50">Назад</button>
          : <span className="text-sm font-medium text-[var(--q-muted)]">Первичный приём</span>}
        <span className="text-sm text-[var(--q-muted)]">Гастроэнтеролог</span>
      </div>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{step.title ?? 'Подготовимся к приёму'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--q-muted)]">
        Ответы помогут не забыть важное. Анкета не заменяет консультацию и не проверяется непрерывно.
      </p>
      {meta.warnings.length ? <aside role="alert" className="mt-5 space-y-2 rounded-xl border border-[#C46A36] bg-[#FFF6EC] p-4 text-base leading-relaxed text-[#713B1C]">
        {meta.warnings.map((warning, i) => <p key={i}>{warning}</p>)}
      </aside> : null}
      {meta.screen === 'ai_wait' ? <div role="status" className="mt-7 rounded-xl border border-[var(--q-border)] p-5">
        <p className="font-medium">Готовим необязательное уточнение…</p>
        <p className="mt-2 text-sm text-[var(--q-muted)]">Можно продолжить без ожидания. Уже введённые ответы сохранятся.</p>
      </div> : null}
      {meta.screen === 'questions' ? <p className="mt-5 rounded-xl bg-[var(--q-surface)] p-4 text-sm leading-relaxed">
        Это последний пункт. Запишите то, что хотите разобрать на приёме, или сразу отправьте анкету.
      </p> : null}
      {meta.summary.length ? <dl className="mt-7 space-y-5">
        {meta.summary.map((item, index) => <div key={index} className="rounded-xl border border-[var(--q-border)] p-4">
          <dt className="font-semibold">{item.label}</dt>
          <dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.value || 'Не сообщено'}</dd>
        </div>)}
      </dl> : null}
      <div className="mt-7 space-y-7">
        {meta.fields.filter((field) => isGastroFieldVisible(field, values)).map((field) => (
          <GastroFieldControl key={field.key} field={field} value={values[field.key]}
            onChange={(value) => { setValues((old) => ({ ...old, [field.key]: value })); setErrors((old) => ({ ...old, [field.key]: '' })); }}
            error={errors[field.key]} disabled={isSubmitting} dateMin={step.date_min} dateMax={step.date_max} />
        ))}
      </div>
      {submitError ? <p role="alert" className="mt-5 rounded-lg bg-[#FFF0ED] p-4 text-sm text-[#A33132]">{submitError} Введённый текст остаётся на этом экране.</p> : null}
      <div className="mt-8 flex flex-col gap-3 border-t border-[var(--q-border)] pt-5">
        {actions.map((action) => <button key={action.value} type="button" disabled={isSubmitting}
          onClick={() => send(action.value)} className={`min-h-13 rounded-xl px-5 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50 ${action.primary ? 'bg-[var(--q-brand)] text-white' : 'border border-[var(--q-border)] bg-[var(--q-surface)] text-[var(--q-text)]'}`}>
          {isSubmitting ? 'Сохраняем…' : action.label}
        </button>)}
      </div>
      {clinicPhone ? <a href={`tel:${clinicPhone}`} className="mt-5 min-h-11 text-center text-sm text-[var(--q-muted)] underline underline-offset-4">Вопросы по записи — связаться с клиникой</a> : null}
    </form>
  );
}
