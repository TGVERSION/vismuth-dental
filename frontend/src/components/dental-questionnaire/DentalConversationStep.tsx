'use client';

import { useEffect, useRef } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  conversationAnswer,
  conversationGroup,
  toggleReply,
} from '@/lib/dental-conversation';
import {
  buildChecklistAnswer,
  parseChecklist,
  scopedChecklistValues,
  setGroupText,
} from '@/lib/dental-questionnaire';
import { useDentalDraft } from '@/hooks/useDentalDraft';
import { SendIcon } from '@/components/questionnaire/icons';
import {
  DentalAssistantMessage,
  DentalButton,
  DentalError,
} from './DentalShell';

const INPUT = 'conversation.input';
const ALLOWED = 'conversation.choices';
const CHECKED = 'conversation.health';
interface Props {
  step: QuestionnaireStep;
  questionnaireId: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (answer: QuestionnaireStepAnswer) => void;
  renderShell: (
    body: React.ReactNode,
    footer: React.ReactNode,
  ) => React.ReactNode;
}

/** Один входящий вопрос и один постоянный редактор ответа. */
export const DentalConversationStep = ({
  step,
  questionnaireId,
  isSubmitting,
  error,
  onSubmit,
  renderShell,
}: Props) => {
  const group = conversationGroup(step);
  const health = step.step_type === 'checklist';
  const key = step.dental?.question_key ?? '';
  const local = {
    ...step,
    step_key: `${step.step_key}:${key}`,
    groups: group ? [group] : [],
  };
  const { draft, setDraft, restored } = useDentalDraft(questionnaireId, local);
  const value = draft.texts[INPUT] ?? '';
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentKey = `${step.step_key}:${key}`;
  const maxLength = group?.text?.max_length ?? 20000;
  const allowed = draft.selections[ALLOWED] ?? [];
  const setValue = (text: string, choices: readonly string[] = allowed) =>
    setDraft((old) => ({
      ...setGroupText(old, INPUT, text, maxLength),
      selections: { ...old.selections, [ALLOWED]: choices },
    }));
  const answer = conversationAnswer(step, value, allowed);
  const options = health ? parseChecklist(step) : (group?.options ?? []);
  const selected = health
    ? (
        draft.selections[CHECKED] ??
        (draft.texts[INPUT] !== undefined
          ? (answer.selections?.health ?? [])
          : scopedChecklistValues(step, draft).checked)
      ).filter((item) => options.some((option) => option.value === item))
    : (answer.selections?.[key] ?? []);
  const question = health
    ? `${step.title ?? 'Здоровье'}\nЧто из этого есть сейчас или было раньше?`
    : [group?.title, group?.question].filter(Boolean).join(': ');
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 136)}px`;
  }, [value, currentKey]);
  const send = () => {
    if (restored && !isSubmitting && value.trim()) onSubmit(answer);
  };
  const choose = (label: string, multiple: boolean, choice: string) => {
    const previous = health && answer.none ? '' : value;
    setValue(
      toggleReply(previous, label, multiple),
      multiple
        ? selected.includes(choice)
          ? allowed.filter((x) => x !== choice)
          : [...allowed, choice]
        : [choice],
    );
  };
  const body = (
    <>
      <DentalAssistantMessage>
        <h2 className="text-base leading-snug whitespace-pre-line font-medium outline-none">
          {question}
        </h2>
        {health ? (
          <p className="mt-2 text-[length:var(--ui-font-size-13)] leading-snug text-[var(--q-muted)]">
            Отметьте подходящие состояния. Учитывайте указанные сроки.
          </p>
        ) : null}
        {!health && group?.multiple && options.length > 1 ? (
          <p className="mt-1 text-[length:var(--ui-font-size-13)] text-[var(--q-muted)]">
            Можно несколько
          </p>
        ) : null}
      </DentalAssistantMessage>
      {health ? (
        <ul
          aria-label="Состояния здоровья"
          className="overflow-hidden rounded-2xl bg-[var(--q-surface)]"
        >
          {options.map((item) => (
            <li
              key={item.value}
              className="border-t border-[var(--q-bg)] px-3 py-1 first:border-t-0"
            >
              <label className="flex min-h-[var(--ui-size-btn-m)] cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  disabled={isSubmitting || !restored}
                  checked={selected.includes(item.value)}
                  onChange={() => {
                    setDraft((old) => ({
                      ...old,
                      selections: {
                        ...old.selections,
                        [CHECKED]: selected.includes(item.value)
                          ? selected.filter((value) => value !== item.value)
                          : [...selected, item.value],
                      },
                    }));
                  }}
                  className="h-[var(--ui-size-checkbox-m)] w-[var(--ui-size-checkbox-m)] shrink-0 accent-[var(--q-brand)]"
                />
                <span className="text-[length:var(--ui-font-size-15)] leading-snug">
                  {item.label}
                  {'hint' in item &&
                  typeof item.hint === 'string' &&
                  item.hint ? (
                    <span className="block text-[length:var(--ui-font-size-13)] text-[var(--q-muted)]">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (group?.multiple || !value.trim()) && options.length ? (
        <div className="flex flex-wrap justify-end gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected.includes(option.value)}
              disabled={isSubmitting || !restored}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                choose(option.label, Boolean(group?.multiple), option.value)
              }
              className={`q-choice rounded-full border border-[var(--q-brand)] px-4 text-base ${selected.includes(option.value) ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]' : 'text-[var(--q-brand)]'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {!health && !value.trim() ? (
        <div className="flex flex-wrap justify-end gap-2">
          {(group?.text?.quick_choices ?? []).map((label) => (
            <button
              key={label}
              type="button"
              disabled={isSubmitting || !restored}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setValue(label, [])}
              className="q-choice min-h-[44px] rounded-full border border-[var(--q-brand)] px-4 text-base text-[var(--q-brand)]"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
  const footer = health ? (
    <>
      <DentalError message={error} />
      <DentalButton
        isBusy={isSubmitting || !restored}
        onClick={() => {
          if (restored && !isSubmitting)
            onSubmit({
              ...buildChecklistAnswer(step.step_key, selected),
              choice: `question:${key}`,
            });
        }}
      >
        {selected.length ? 'Далее' : 'Ничего из этого нет'}
      </DentalButton>
    </>
  ) : (
    <>
      <DentalError message={error} />
      <form
        className="q-composer flex items-end gap-2 bg-[var(--q-surface)] px-4 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={inputRef}
          value={value}
          rows={1}
          aria-label="Ваш ответ"
          placeholder="Сообщение"
          readOnly={isSubmitting || !restored}
          maxLength={maxLength}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
          className="min-w-0 flex-1 resize-none bg-transparent py-3 text-base outline-none"
        />
        <button
          type="submit"
          aria-label={
            key === 'about.more' ? 'Отправить анкету' : 'Отправить ответ'
          }
          disabled={isSubmitting || !restored || !value.trim()}
          onMouseDown={(e) => e.preventDefault()}
          className="q-icon-button mb-1 flex shrink-0 items-center justify-center text-[var(--q-brand)] disabled:opacity-40"
        >
          {isSubmitting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-b-transparent" />
          ) : (
            <SendIcon className="h-6 w-6" />
          )}
        </button>
      </form>
      {step.allow_skip || step.dental?.allow_empty ? (
        <button
          type="button"
          disabled={isSubmitting || !restored}
          onClick={() =>
            onSubmit(
              step.allow_skip
                ? { step_key: step.step_key, skip: true }
                : conversationAnswer(step, ''),
            )
          }
          className="min-h-[44px] self-end px-2 text-sm text-[var(--q-brand)]"
        >
          Пропустить
        </button>
      ) : null}
    </>
  );
  return <>{renderShell(body, footer)}</>;
};
