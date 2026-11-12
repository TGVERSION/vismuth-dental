'use client';

import { useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  buildGroupsAnswer,
  canSubmitGroups,
  groupProblem,
  isDentalDetailsStep,
  isTextVisible,
  parseGroups,
  setGroupText,
  toggleOption,
} from '@/lib/dental-questionnaire';
import { useDentalDraft } from '@/hooks/useDentalDraft';
import { DentalButton, DentalError } from './DentalShell';
import { DentalGroupField } from './DentalGroupField';

interface ChipGroupsStepProps {
  step: QuestionnaireStep;
  questionnaireId: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (answer: QuestionnaireStepAnswer) => void;
  /** «Пропустить» — у вопроса нейросети (`allow_skip`). */
  onSkip?: () => void;
  /** Над первым вопросом: приветствие и время приёма. */
  intro?: React.ReactNode;
  renderShell: (
    body: React.ReactNode,
    footer: React.ReactNode,
  ) => React.ReactNode;
}

/** Шаг из групп кнопок: повод визита, боль, уточнения по отмеченному. */
export const ChipGroupsStep = ({
  step,
  questionnaireId,
  isSubmitting,
  error,
  onSubmit,
  onSkip,
  intro,
  renderShell,
}: ChipGroupsStepProps) => {
  const groups = parseGroups(step);
  const { draft, setDraft, restored } = useDentalDraft(questionnaireId, step);
  const [showProblems, setShowProblems] = useState(false);
  const needsChoice = groups.some(
    (group) =>
      group.options.length > 0 && groupProblem(group, draft) === 'choose',
  );
  const canSubmit = canSubmitGroups(groups, draft);
  const nextDisabled =
    needsChoice || (isDentalDetailsStep(step.step_key) && !canSubmit);

  const handleNext = () => {
    if (!restored || nextDisabled) return;
    if (!canSubmit) {
      setShowProblems(true);
      const first = groups.find((group) => groupProblem(group, draft) !== null);
      const problem = first ? groupProblem(first, draft) : null;
      // После отрисовки: поле текста могло ещё не появиться.
      if (first && problem)
        requestAnimationFrame(() => {
          const field = document.getElementById(`group-${first.key}`);
          const main = field?.closest('main');
          if (!field || !main) return;
          const input =
            problem === 'text' || first.options.length === 0
              ? field.querySelector<HTMLElement>(
                  'textarea, input:not([type="checkbox"])',
                )
              : null;
          const target =
            input ?? document.getElementById(`problem-${first.key}`) ?? field;
          const viewport = main.getBoundingClientRect();
          const bounds = target.getBoundingClientRect();
          // Прокручиваем только форму внутри закреплённого экрана.
          if (bounds.top < viewport.top + 12) {
            main.scrollTop += bounds.top - viewport.top - 12;
          } else if (bounds.bottom > viewport.bottom - 12) {
            main.scrollTop += bounds.bottom - viewport.bottom + 12;
          }
          input?.focus({ preventScroll: true });
        });
      return;
    }
    onSubmit(buildGroupsAnswer(step.step_key, groups, draft));
  };

  const body = (
    <>
      {intro}
      {groups.map((group) => (
        <DentalGroupField
          key={group.key}
          group={group}
          selected={draft.selections[group.key] ?? []}
          text={draft.texts[group.key] ?? ''}
          showText={isTextVisible(group, draft)}
          problem={showProblems ? groupProblem(group, draft) : null}
          disabled={isSubmitting || !restored}
          onToggle={(value) =>
            setDraft((current) => toggleOption(current, group, value))
          }
          onText={(text) =>
            setDraft((current) =>
              setGroupText(current, group.key, text, group.text?.max_length),
            )
          }
        />
      ))}
    </>
  );

  const footer = (
    <>
      <DentalError message={error} />
      {onSkip && step.allow_skip && !isSubmitting ? (
        <DentalButton variant="soft" onClick={onSkip}>
          Пропустить
        </DentalButton>
      ) : null}
      <DentalButton
        onClick={handleNext}
        isBusy={isSubmitting || !restored}
        disabled={nextDisabled}
      >
        {step.step_key === 'dental_about' ? 'Отправить анкету' : 'Далее'}
      </DentalButton>
    </>
  );

  return <>{renderShell(body, footer)}</>;
};
