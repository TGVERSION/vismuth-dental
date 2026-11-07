'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  buildGastroAnswer,
  gastroMeta,
  isGastroFieldVisible,
  toggleGastroChoice,
  validateGastroFields,
  type GastroMeta,
  type GastroValues,
} from '@/lib/gastro-questionnaire';
import { gastroChatNextField, gastroChatReply } from '@/lib/gastro-chat';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { ChatBubble, TypingIndicator } from '../questionnaire/ChatBubble';
import { BackIcon } from '../questionnaire/icons';
import { GastroFieldControl } from './GastroFieldControl';

interface Props {
  step: QuestionnaireStep;
  submit: (
    answer: QuestionnaireStepAnswer,
  ) => Promise<QuestionnaireStep | null>;
  isSubmitting: boolean;
  submitError: string | null;
  clinicPhone?: string | null;
}
type Entry = { author: 'assistant' | 'patient'; text: string };
type Section = { key: string; entries: Entry[] };

/** Keep the same conversation mounted across server sections, including AI polling. */
export function GastroQuestionnaireStep(props: Props) {
  const [history, setHistory] = useState<Section[]>([]);
  const meta = gastroMeta(props.step);
  if (!meta)
    return (
      <p role="alert">
        Не удалось показать вопрос. Обновите страницу — отправленные ответы
        сохранены.
      </p>
    );
  return (
    <GastroChatSection
      {...props}
      meta={meta}
      key={`${props.step.step_key}:${meta.revision}`}
      history={history.flatMap((section) => section.entries)}
      onAccepted={(next, entries, action) =>
        setHistory((previous) => {
          const revisited = previous.findIndex(
            (section) => section.key === next.step_key,
          );
          if (
            action === 'back' ||
            action?.startsWith('edit:') ||
            revisited >= 0
          )
            return revisited < 0 ? [] : previous.slice(0, revisited);
          if (action === 'change_doctor' || action === 'change_specialization')
            return [];
          return [...previous, { key: props.step.step_key, entries }];
        })
      }
    />
  );
}

function GastroChatSection({
  step,
  submit,
  isSubmitting,
  submitError,
  clinicPhone,
  meta,
  history,
  onAccepted,
}: Props & {
  meta: GastroMeta;
  history: Entry[];
  onAccepted: (
    next: QuestionnaireStep,
    entries: Entry[],
    action?: string,
  ) => void;
}) {
  const [values, setValues] = useState<GastroValues>(() => meta.values);
  const [activeKey, setActiveKey] = useState(
    () =>
      meta.fields.find((field) => isGastroFieldVisible(field, meta.values))
        ?.key ?? null,
  );
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();
  const desktop = useIsDesktop();
  const fit = desktop ? null : viewport;
  const visible = meta.fields.filter((field) =>
    isGastroFieldVisible(field, values),
  );
  const active = visible.find((field) => field.key === activeKey) ?? null;
  const index = active
    ? visible.findIndex((field) => field.key === active.key)
    : visible.length;
  const answered = visible.slice(0, index);
  const localEntries: Entry[] = answered.flatMap((field) => [
    { author: 'assistant', text: field.label },
    { author: 'patient', text: gastroChatReply(field, values[field.key]) },
  ]);
  const locked = isSubmitting || sending;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    const observer = new ResizeObserver(() => {
      list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeKey, history.length, error, submitError]);

  async function send(nextValues: GastroValues, action = 'continue') {
    if (sendingRef.current || isSubmitting) return;
    if (action === 'continue') {
      const issues = validateGastroFields(meta.fields, nextValues);
      const invalid = visible.find((field) => issues[field.key]);
      if (invalid) {
        setActiveKey(invalid.key);
        setError(issues[invalid.key]);
        return;
      }
    }
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      // Persist the whole original server section, not a new server step per bubble.
      const answer = buildGastroAnswer(
        step,
        nextValues,
        action === 'continue' ? undefined : action,
      );
      if (action === 'continue') answer.choice = 'continue';
      const next = await submit(answer);
      if (
        next &&
        (next.step_key !== step.step_key ||
          gastroMeta(next)?.revision !== meta.revision)
      ) {
        const entries: Entry[] = visible.flatMap((field) => [
          { author: 'assistant', text: field.label },
          {
            author: 'patient',
            text: gastroChatReply(field, nextValues[field.key]),
          },
        ]);
        if (!visible.length)
          entries.push(
            { author: 'assistant', text: step.title ?? meta.section },
            {
              author: 'patient',
              text:
                meta.actions.find((item) => item.value === action)?.label ??
                'Продолжить',
            },
          );
        onAccepted(next, entries, action);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function advance(nextValues = values) {
    if (!active || locked) return;
    const issue = validateGastroFields([active], nextValues)[active.key];
    if (issue) {
      setError(issue);
      return;
    }
    setValues(nextValues);
    setError('');
    const next = gastroChatNextField(meta.fields, nextValues, active.key);
    if (next) setActiveKey(next.key);
    else void send(nextValues);
  }
  function back() {
    if (locked) return;
    setError('');
    if (index > 0) setActiveKey(visible[index - 1].key);
    else void send(values, 'back');
  }
  const actions = meta.actions.length
    ? meta.actions
    : [
        {
          value: 'continue',
          label:
            meta.screen === 'questions' ? 'Отправить анкету' : 'Продолжить',
          primary: true,
        },
      ];
  const currentWarnings =
    active?.options
      ?.filter(
        (option) =>
          (Array.isArray(values[active.key])
            ? values[active.key]
            : [values[active.key]]
          ).includes(option.value) && option.warning,
      )
      .map((option) => option.warning) ?? [];

  return (
    <div
      className="q-screen-fixed flex flex-col bg-[var(--q-bg)]"
      style={
        fit
          ? {
              height: `${fit.height}px`,
              transform: `translateY(${fit.offsetTop}px)`,
            }
          : undefined
      }
    >
      <header className="flex shrink-0 items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-3">
        {(index > 0 || meta.can_back) && (
          <button
            type="button"
            aria-label="Предыдущий вопрос"
            onClick={back}
            disabled={locked}
            className="q-icon-button -ml-2 flex shrink-0 items-center justify-center"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-[length:var(--ui-font-size-26)] font-bold">
          Чат с Ассистентом
        </h1>
      </header>
      <div
        ref={listRef}
        role="log"
        aria-label="Переписка с Ассистентом"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 max-md:overscroll-contain"
      >
        <div className="mt-auto space-y-3">
          <p className="text-center text-sm text-[var(--q-muted)]">
            Ответы увидит только ваш врач
          </p>
          {[...history, ...localEntries].map((entry, i) => (
            <ChatBubble key={i} author={entry.author}>
              {entry.text}
            </ChatBubble>
          ))}
          {meta.warnings.map((warning, i) => (
            <div key={`warning-${i}`} role="alert">
              <ChatBubble author="assistant">{warning}</ChatBubble>
            </div>
          ))}
          {meta.summary.map((item, i) => (
            <ChatBubble
              key={`summary-${i}`}
              author="assistant"
            >{`${item.label}\n${item.value || 'Не сообщено'}`}</ChatBubble>
          ))}
          <ChatBubble author="assistant">
            {active?.label ??
              (meta.screen === 'ai_wait'
                ? 'Готовим необязательное уточнение. Можно продолжить без ожидания — ответы сохранятся.'
                : (step.title ?? meta.section))}
          </ChatBubble>
          {active?.help && (
            <ChatBubble author="assistant">{active.help}</ChatBubble>
          )}
          {currentWarnings.map((warning, i) => (
            <div role="alert" key={`current-warning-${i}`}>
              <ChatBubble author="assistant">{warning}</ChatBubble>
            </div>
          ))}
          {locked && <TypingIndicator hint={null} />}
        </div>
      </div>
      <div className="max-h-[50dvh] shrink-0 overflow-y-auto bg-[var(--q-bg)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {submitError && (
          <p
            role="alert"
            className="mb-3 text-sm text-[var(--ui-color-red-800)]"
          >
            {submitError} Ответ сохранён в поле — попробуйте отправить ещё раз.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-3 text-sm text-[var(--ui-color-red-800)]"
          >
            {error}
          </p>
        )}
        {active ? (
          <>
            {active.type === 'single' || active.type === 'multi' ? (
              <div
                role="group"
                aria-label={active.label}
                className="mb-3 flex flex-wrap justify-end gap-2"
              >
                {active.options?.map((option) => {
                  const selected = (
                    Array.isArray(values[active.key])
                      ? values[active.key]
                      : [values[active.key]]
                  ).includes(option.value);
                  return (
                    <button
                      type="button"
                      key={option.value}
                      disabled={locked}
                      aria-pressed={selected}
                      className={`q-choice border border-[var(--q-brand)] ${selected ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]' : 'bg-[var(--q-bg)] text-[var(--q-brand)]'}`}
                      onClick={() => {
                        const value = toggleGastroChoice(
                          active,
                          Array.isArray(values[active.key])
                            ? (values[active.key] as string[])
                            : [],
                          option.value,
                        );
                        const nextValues = { ...values, [active.key]: value };
                        setValues(nextValues);
                        setError('');
                        // Warnings remain visible until explicitly acknowledged with Send.
                        if (active.type === 'single' && !option.warning)
                          advance(nextValues);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mb-3" key={active.key} onKeyDown={event => {if ((active.type === 'text' || active.type === 'multiline') && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();advance();}}}>
                <GastroFieldControl
                  field={active}
                  hideLabel
                  value={values[active.key]}
                  onChange={(value) => {
                    setValues((previous) => ({
                      ...previous,
                      [active.key]: value,
                    }));
                    setError('');
                  }}
                  disabled={locked}
                  dateMin={step.date_min}
                  dateMax={step.date_max}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {!active.required && !active.options?.some(option => option.label === 'Пропустить') && (
                <button
                  type="button"
                  disabled={locked}
                  className="min-h-11 text-sm text-[var(--q-muted)] underline"
                  onClick={() =>
                    advance({
                      ...values,
                      [active.key]:
                        active.type === 'single' ||
                        active.type === 'multi' ||
                        active.type === 'list'
                          ? []
                          : '',
                    })
                  }
                >
                  Пропустить
                </button>
              )}
              {(active.type !== 'single' || currentWarnings.length > 0) && (
                <button
                  type="button"
                  disabled={locked}
                  className="q-button"
                  onClick={() => advance()}
                >
                  {meta.screen === 'questions' &&
                  !gastroChatNextField(meta.fields, values, active.key)
                    ? 'Отправить анкету'
                    : 'Отправить'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {actions.map((action) => (
              <button
                type="button"
                key={action.value}
                disabled={locked}
                className="q-button"
                data-variant={action.primary ? 'primary' : 'secondary'}
                onClick={() => void send(values, action.value)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        {active?.type === 'multi' && (
          <p className="mt-2 text-xs text-[var(--q-muted)]">
            Можно выбрать несколько вариантов, затем отправить ответ.
          </p>
        )}
        {clinicPhone && (
          <a
            className="mt-2 block text-center text-xs text-[var(--q-muted)] underline"
            href={`tel:${clinicPhone}`}
          >
            Связаться с клиникой
          </a>
        )}
      </div>
    </div>
  );
}
