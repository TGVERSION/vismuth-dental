'use client';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  buildChecklistAnswer,
  parseChecklist,
  scopedChecklistValues,
} from '@/lib/dental-questionnaire';
import { useDentalDraft } from '@/hooks/useDentalDraft';
import { DentalButton, DentalError } from './DentalShell';
interface ChecklistStepProps {
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
export const ChecklistStep = ({
  step,
  questionnaireId,
  isSubmitting,
  error,
  onSubmit,
  renderShell,
}: ChecklistStepProps) => {
  const items = parseChecklist(step);
  const { draft, setDraft, restored } = useDentalDraft(questionnaireId, step);
  const { checked, uncertain } = scopedChecklistValues(step, draft);
  const healthPage = step.dental?.page?.kind === 'health';
  const comment = draft.texts.health ?? '';
  const toggle = (value: string, unknown: boolean) => {
    setDraft((current) => {
      const key = unknown ? 'health_unknown' : 'health';
      const other = unknown ? 'health' : 'health_unknown';
      const selected = current.selections[key] ?? [];
      return {
        ...current,
        selections: {
          ...current.selections,
          [key]: selected.includes(value)
            ? selected.filter((x) => x !== value)
            : [...selected, value],
          [other]: (current.selections[other] ?? []).filter((x) => x !== value),
        },
      };
    });
  };
  const body = (
    <>
      <h2 id="health-question" className="sr-only">
        Состояния здоровья
      </h2>
      <ul
        role="group"
        aria-labelledby="health-question"
        className="flex flex-col overflow-hidden rounded-2xl bg-[var(--q-surface)]"
      >
        {items.map((item, index) => (
          <li
            key={item.value}
            className="border-t border-[var(--q-bg)] first:border-t-0"
          >
            {!healthPage &&
            item.section &&
            (index === 0 || items[index - 1].section !== item.section) ? (
              <h3 className="bg-[var(--q-bg)] px-4 pt-5 pb-2 text-base font-semibold">
                {item.section}
              </h3>
            ) : null}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-1">
              <label className="flex min-h-[var(--ui-size-btn-m)] min-w-0 cursor-pointer items-center gap-3 py-[var(--ui-space-10)]">
                <input
                  type="checkbox"
                  checked={checked.includes(item.value)}
                  onChange={() => toggle(item.value, false)}
                  disabled={isSubmitting || !restored}
                  className="h-[var(--ui-size-checkbox-m)] w-[var(--ui-size-checkbox-m)] shrink-0 accent-[var(--q-brand)]"
                />
                <span className="text-base leading-snug">
                  {item.label}
                  {uncertain.includes(item.value) ? (
                    <span className="block text-sm text-[var(--q-muted)]">
                      Ранее указан неопределённый ответ
                    </span>
                  ) : null}
                  {item.hint ? (
                    <span className="block text-[length:var(--ui-font-size-13)] text-[var(--q-muted)]">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </label>
            </div>
          </li>
        ))}
      </ul>
      {comment ? (
        <p
          className="whitespace-pre-wrap text-base text-[var(--q-muted)]"
          aria-label="Ранее сохранённое уточнение"
        >
          {comment}
        </p>
      ) : null}
    </>
  );
  return (
    <>
      {renderShell(
        body,
        <>
          <DentalError message={error} />
          <DentalButton
            isBusy={isSubmitting || !restored}
            onClick={() => {
              if (!restored) return;
              onSubmit({
                ...buildChecklistAnswer(step.step_key, checked, uncertain),
                ...(comment.trim()
                  ? { none: false, texts: { health: comment.trim() } }
                  : {}),
              });
            }}
          >
            {checked.length || uncertain.length || comment.trim()
              ? 'Далее'
              : 'Ничего из этого нет'}
          </DentalButton>
        </>,
      )}
    </>
  );
};
