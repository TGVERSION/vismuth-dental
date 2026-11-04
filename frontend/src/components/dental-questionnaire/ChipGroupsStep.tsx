'use client';

import { useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { FIELD_CLASS } from '@/components/questionnaire/field-styles';
import { ANSWER_MAX_LENGTH } from '@/lib/questionnaire';
import {
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
import { useDentalDraft } from '@/hooks/useDentalDraft';
import {
  DentalAssistantMessage,
  DentalButton,
  DentalError,
} from './DentalShell';

const PROBLEM_TEXT: Record<GroupProblem, string> = {
  choose: 'Выберите хотя бы один вариант',
  text: 'Напишите, пожалуйста, пару слов',
};

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

interface ChipGroupProps {
  group: DentalGroup;
  selected: readonly string[];
  text: string;
  showText: boolean;
  problem: GroupProblem | null;
  showMultipleHint: boolean;
  onToggle: (value: string) => void;
  onText: (text: string) => void;
  disabled: boolean;
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
    problem === 'text' ? 'textarea, input' : 'button',
  );
  target?.focus({ preventScroll: true });
};

const ChipGroup = ({
  group,
  selected,
  text,
  showText,
  problem,
  showMultipleHint,
  onToggle,
  onText,
  disabled,
}: ChipGroupProps) => {
  const [expanded, setExpanded] = useState(Boolean(text));
  const [rawInput, setRawInput] = useState(
    Boolean(
      text &&
      group.text?.input_kind === 'date' &&
      !/^\d{4}-\d{2}-\d{2}$/.test(text),
    ),
  );
  const useRawInput =
    rawInput ||
    Boolean(
      text &&
      group.text?.input_kind === 'date' &&
      !/^\d{4}-\d{2}-\d{2}$/.test(text),
    );
  const questionId = `q-${group.key}`;
  const problemId = `problem-${group.key}`;
  const collapsed = Boolean(
    showText && group.text?.optional_reveal && !expanded && !text,
  );
  return (
    <fieldset
      disabled={disabled}
      id={groupElementId(group.key)}
      role="group"
      aria-labelledby={questionId}
      className="flex min-w-0 flex-col gap-3"
    >
      {!collapsed ? (
        <DentalAssistantMessage>
          <h2 id={questionId} className="text-base leading-snug font-medium">
            {group.title ? `${group.title}: ` : ''}
            {group.question}
          </h2>
          {showMultipleHint ? (
            <p className="mt-1 text-[13px] text-[var(--q-muted)]">
              Можно несколько
            </p>
          ) : null}
        </DentalAssistantMessage>
      ) : null}

      {group.options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {group.options.map((option) => {
            const isOn = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {collapsed ? (
        <button
          id={questionId}
          type="button"
          className="min-h-[44px] self-start text-[var(--q-brand)] underline"
          onClick={() => setExpanded(true)}
        >
          {group.question}
        </button>
      ) : null}
      {showText &&
      group.text &&
      (!group.text.optional_reveal || expanded || Boolean(text)) ? (
        <>
          {!text.trim() && (group.text.quick_choices?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2">
              {group.text.quick_choices?.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={text === choice}
                  onClick={() => {
                    setRawInput(true);
                    onText(choice);
                  }}
                  className={`min-h-[44px] rounded-full border border-[var(--q-brand)] px-4 text-[15px] ${text === choice ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]' : 'text-[var(--q-brand)]'}`}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : null}
          {group.text.input_kind && group.text.input_kind !== 'text' ? (
            <>
              <input
                disabled={disabled}
                type={
                  group.text.input_kind === 'date' && !useRawInput
                    ? 'date'
                    : 'text'
                }
                inputMode={useRawInput ? 'text' : group.text.input_mode}
                aria-labelledby={questionId}
                aria-invalid={problem === 'text'}
                aria-describedby={problem ? problemId : undefined}
                value={text}
                maxLength={group.text.max_length ?? ANSWER_MAX_LENGTH}
                placeholder={group.text.placeholder}
                onChange={(event) => onText(event.target.value)}
                className={`${FIELD_CLASS} min-h-[52px] w-full py-3 focus:ring-2 focus:ring-[var(--q-brand)]`}
              />
              <button
                type="button"
                aria-label={
                  rawInput
                    ? 'Переключить на цифровой ввод'
                    : 'Написать в свободной форме'
                }
                onClick={() => setRawInput((current) => !current)}
                className="min-h-[44px] self-start text-sm text-[var(--q-brand)] underline"
              >
                {rawInput
                  ? group.text.input_kind === 'date'
                    ? 'Календарь'
                    : 'Цифрами'
                  : 'Текстом'}
              </button>
            </>
          ) : (
            <textarea
              disabled={disabled}
              aria-labelledby={questionId}
              aria-invalid={problem === 'text'}
              aria-describedby={problem ? problemId : undefined}
              value={text}
              rows={2}
              maxLength={group.text.max_length ?? ANSWER_MAX_LENGTH}
              placeholder={group.text.placeholder}
              onChange={(event) => onText(event.target.value)}
              className={`${FIELD_CLASS} w-full resize-none py-3 focus:ring-2 focus:ring-[var(--q-brand)]`}
            />
          )}
        </>
      ) : null}

      {problem ? (
        <p id={problemId} role="alert" className="text-sm text-[#C2334D]">
          {PROBLEM_TEXT[problem]}
        </p>
      ) : null}
    </fieldset>
  );
};

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

  const handleNext = () => {
    if (!restored) return;
    if (!canSubmitGroups(groups, draft)) {
      setShowProblems(true);
      const first = groups.find((group) => groupProblem(group, draft) !== null);
      const problem = first ? groupProblem(first, draft) : null;
      // После отрисовки: поле текста могло ещё не появиться.
      if (first && problem)
        requestAnimationFrame(() => revealProblem(first.key, problem));
      return;
    }
    onSubmit(buildGroupsAnswer(step.step_key, groups, draft));
  };

  const body = (
    <>
      {intro}
      {step.dental?.page?.kind === 'details' && step.title ? (
        <p className="text-center text-[13px] text-[var(--q-muted)]">
          {step.title}
        </p>
      ) : null}
      {step.dental?.page?.kind === 'details' && step.text ? (
        <p className="text-sm text-[var(--q-muted)]">{step.text}</p>
      ) : null}
      {groups.map((group, index) => (
        <ChipGroup
          key={group.key}
          group={group}
          selected={draft.selections[group.key] ?? []}
          text={draft.texts[group.key] ?? ''}
          showText={isTextVisible(group, draft)}
          problem={showProblems ? groupProblem(group, draft) : null}
          showMultipleHint={
            index ===
            groups.findIndex((item) => item.multiple && item.options.length > 1)
          }
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
      <DentalButton onClick={handleNext} isBusy={isSubmitting}>
        {step.step_key === 'dental_about' ? 'Отправить анкету' : 'Далее'}
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
