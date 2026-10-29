'use client';

import { useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { FIELD_CLASS } from '@/components/questionnaire/field-styles';
import { ANSWER_MAX_LENGTH } from '@/lib/questionnaire';
import {
  EMPTY_DRAFT,
  buildGroupsAnswer,
  canSubmitGroups,
  groupProblem,
  isTextVisible,
  parseGroups,
  setGroupText,
  toggleOption,
  type DentalGroup,
  type GroupProblem,
} from '@/lib/dental-questionnaire';
import { DentalButton, DentalError } from './DentalShell';

const PROBLEM_TEXT: Record<GroupProblem, string> = {
  choose: 'Выберите хотя бы один вариант',
  text: 'Напишите, пожалуйста, пару слов',
};

interface ChipGroupsStepProps {
  step: QuestionnaireStep;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (answer: QuestionnaireStepAnswer) => void;
  /** «Пропустить» — у вопроса нейросети (`allow_skip`). */
  onSkip?: () => void;
  /** Над первым вопросом: приветствие и время приёма. */
  intro?: React.ReactNode;
  renderShell: (body: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
}

interface ChipGroupProps {
  group: DentalGroup;
  selected: readonly string[];
  text: string;
  showText: boolean;
  problem: GroupProblem | null;
  isFirst: boolean;
  onToggle: (value: string) => void;
  onText: (text: string) => void;
}

const groupElementId = (key: string) => `group-${key}`;

/**
 * Первая группа с проблемой: прокрутить к ней и поставить фокус. Кнопка
 * «Далее» прижата к низу, и без этого подсказка у группы ниже экрана
 * осталась бы невидимой — нажатие выглядело бы так, будто ничего не
 * произошло.
 */
const revealProblem = (key: string, problem: GroupProblem) => {
  const element = document.getElementById(groupElementId(key));
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const target = element.querySelector<HTMLElement>(
    problem === 'text' ? 'textarea' : 'button',
  );
  target?.focus({ preventScroll: true });
};

const ChipGroup = ({
  group,
  selected,
  text,
  showText,
  problem,
  isFirst,
  onToggle,
  onText,
}: ChipGroupProps) => {
  const questionId = `q-${group.key}`;
  const problemId = `problem-${group.key}`;
  return (
    <div
      id={groupElementId(group.key)}
      role="group"
      aria-labelledby={questionId}
      className="flex flex-col gap-3"
    >
      {group.title ? (
        <p className="text-[13px] font-semibold text-[var(--q-muted)]">{group.title}</p>
      ) : null}
      <h2
        id={questionId}
        className={isFirst ? 'text-[23px] leading-tight font-semibold' : 'text-base font-semibold'}
      >
        {group.question}
      </h2>
      {group.multiple && group.options.length > 1 ? (
        <p className="-mt-2 text-sm text-[var(--q-muted)]">Можно выбрать несколько</p>
      ) : null}

      {group.options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {group.options.map((option) => {
            const isOn = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggle(option.value)}
                // Кнопка-вариант — как быстрые ответы в чате общей анкеты.
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--q-brand)] px-4 py-2 text-base leading-tight transition-colors ${
                  isOn
                    ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]'
                    : 'bg-[var(--q-bg)] text-[var(--q-brand)]'
                }`}
              >
                {/* Галочка: выбор виден не только по цвету. */}
                {isOn ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {showText && group.text ? (
        <textarea
          aria-labelledby={questionId}
          aria-invalid={problem === 'text'}
          aria-describedby={problem ? problemId : undefined}
          value={text}
          rows={2}
          maxLength={ANSWER_MAX_LENGTH}
          placeholder={group.text.placeholder}
          onChange={(event) => onText(event.target.value)}
          className={`${FIELD_CLASS} w-full resize-none py-3 focus:ring-2 focus:ring-[var(--q-brand)]`}
        />
      ) : null}

      {problem ? (
        <p id={problemId} role="alert" className="text-sm text-[#C2334D]">
          {PROBLEM_TEXT[problem]}
        </p>
      ) : null}
    </div>
  );
};

/** Шаг из групп кнопок: повод визита, боль, уточнения по отмеченному. */
export const ChipGroupsStep = ({
  step,
  isSubmitting,
  error,
  onSubmit,
  onSkip,
  intro,
  renderShell,
}: ChipGroupsStepProps) => {
  const groups = parseGroups(step);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showProblems, setShowProblems] = useState(false);

  const handleNext = () => {
    if (!canSubmitGroups(groups, draft)) {
      setShowProblems(true);
      const first = groups.find((group) => groupProblem(group, draft) !== null);
      const problem = first ? groupProblem(first, draft) : null;
      // После отрисовки: поле текста могло ещё не появиться.
      if (first && problem) requestAnimationFrame(() => revealProblem(first.key, problem));
      return;
    }
    onSubmit(buildGroupsAnswer(step.step_key, groups, draft));
  };

  const body = (
    <>
      {intro}
      {groups.map((group, index) => (
        <ChipGroup
          key={group.key}
          group={group}
          selected={draft.selections[group.key] ?? []}
          text={draft.texts[group.key] ?? ''}
          showText={isTextVisible(group, draft)}
          problem={showProblems ? groupProblem(group, draft) : null}
          isFirst={index === 0}
          onToggle={(value) => setDraft((current) => toggleOption(current, group, value))}
          onText={(text) => setDraft((current) => setGroupText(current, group.key, text))}
        />
      ))}
    </>
  );

  const footer = (
    <>
      <DentalError message={error} />
      <DentalButton onClick={handleNext} isBusy={isSubmitting}>
        Далее
      </DentalButton>
      {onSkip && step.allow_skip && !isSubmitting ? (
        <DentalButton variant="soft" onClick={onSkip}>
          Пропустить
        </DentalButton>
      ) : null}
    </>
  );

  return <>{renderShell(body, footer)}</>;
};
