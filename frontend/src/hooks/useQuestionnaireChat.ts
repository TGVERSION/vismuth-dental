'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import {
  buildAnswer,
  chatPrompt,
  estimateProgress,
  patientReplyText,
  screenForStep,
  type ChatAction,
  type ChatPrompt,
} from '@/lib/questionnaire';

/** Через сколько подсказывать пациенту, что ассистент ещё думает. */
const HINT_THINKING_MS = 15_000;
const HINT_LONGER_MS = 45_000;

export type ChatEntry =
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'patient'; id: string; text: string };

export interface UseQuestionnaireChatOptions {
  /** Текущий шаг сервера — чатный. */
  step: QuestionnaireStep;
  submit: (
    answer: QuestionnaireStepAnswer,
  ) => Promise<QuestionnaireStep | null>;
  isSubmitting: boolean;
}

export interface UseQuestionnaireChatResult {
  entries: ChatEntry[];
  /** Вопрос текущего шага: по нему строятся чипы и поле ввода. */
  prompt: ChatPrompt;
  isAwaiting: boolean;
  waitHint: string | null;
  /** Доля пройденного от 0 до 1 для индикатора. */
  progress: number;
  send: (action: ChatAction) => void;
  retry: () => void;
}

const assistantEntry = (
  step: QuestionnaireStep,
  index: number,
): ChatEntry[] => {
  const { text } = chatPrompt(step);
  return text
    ? [{ kind: 'assistant', id: `assistant-${step.step_key}-${index}`, text }]
    : [];
};

/**
 * Лента чата поверх шагов сервера.
 *
 * Пузыри добавляются в обработчиках, а не эффектом «при смене шага»:
 * синхронный setState в эффекте запрещён правилом линтера, а в StrictMode
 * эффект сработал бы дважды и задвоил пузыри. Первый вопрос — из шага при
 * монтировании; следующий — из шага, который вернул ответ.
 *
 * Ожидание ответа может дойти до полуминуты: backend ждёт ИИ. Повторной
 * отправки по таймеру нет — пациенту показываются подсказки об ожидании.
 */
export const useQuestionnaireChat = ({
  step,
  submit,
  isSubmitting,
}: UseQuestionnaireChatOptions): UseQuestionnaireChatResult => {
  const [entries, setEntries] = useState<ChatEntry[]>(() =>
    assistantEntry(step, 0),
  );
  const [waitHint, setWaitHint] = useState<string | null>(null);
  // Ждём не только запрос, но и добавление следующего вопроса в ленту:
  // родитель может снять isSubmitting раньше, чем завершится deliver.
  const [isDelivering, setIsDelivering] = useState(false);
  const isAwaiting = isSubmitting || isDelivering;

  // Последний отправленный ответ: «Повторить» шлёт его без второго пузыря.
  const lastAnswerRef = useRef<QuestionnaireStepAnswer | null>(null);
  // Проверка до записи пузыря в ленту: isSubmitting обновляется асинхронно,
  // и при двойном нажатии второй пузырь остался бы без запроса.
  const isSendingRef = useRef(false);

  const prompt = useMemo(() => chatPrompt(step), [step]);
  const answered = entries.filter((entry) => entry.kind === 'patient').length;

  // Подсказки об ожидании. Таймеры живут только пока идёт запрос.
  useEffect(() => {
    if (!isAwaiting) return;

    const thinking = setTimeout(
      () => setWaitHint('Ассистент думает…'),
      HINT_THINKING_MS,
    );
    const longer = setTimeout(
      () => setWaitHint('Это занимает больше обычного, подождите немного'),
      HINT_LONGER_MS,
    );

    return () => {
      clearTimeout(thinking);
      clearTimeout(longer);
      setWaitHint(null);
    };
  }, [isAwaiting]);

  const deliver = useCallback(
    async (answer: QuestionnaireStepAnswer) => {
      isSendingRef.current = true;
      setIsDelivering(true);
      const identifiedAnswer = answer.answer_id
        ? answer
        : { ...answer, answer_id: crypto.randomUUID() };
      lastAnswerRef.current = identifiedAnswer;

      try {
        const next = await submit(identifiedAnswer);
        // Ошибка или ответ устаревшей анкеты — пузыря нет, ошибку и
        // «Повторить» показывает экран по состоянию хука анкеты.
        if (!next) return;

        lastAnswerRef.current = null;
        if (screenForStep(next) !== 'chat') return;

        setEntries((prev) => [...prev, ...assistantEntry(next, prev.length)]);
      } finally {
        isSendingRef.current = false;
        setIsDelivering(false);
      }
    },
    [submit],
  );

  const send = useCallback(
    (action: ChatAction) => {
      if (isSendingRef.current || isSubmitting) return;

      const text = patientReplyText(prompt, action);
      setEntries((prev) => [
        ...prev,
        { kind: 'patient', id: `patient-${prev.length}`, text },
      ]);
      void deliver(buildAnswer(step, action));
    },
    [deliver, prompt, step, isSubmitting],
  );

  const retry = useCallback(() => {
    const answer = lastAnswerRef.current;
    if (!answer || isSendingRef.current) return;

    // Пузырь пациента уже в ленте — повторяем только запрос. Если сервер
    // успел принять ответ, хук анкеты увидит это по сменившемуся шагу (или
    // по 409) и продолжит со следующего вопроса без повторной отправки.
    void deliver(answer);
  }, [deliver]);

  return {
    entries,
    prompt,
    isAwaiting,
    waitHint,
    // backend прогресс не отдаёт (ВЗ-3) — оценка по числу ответов.
    progress: estimateProgress(answered, false),
    send,
    retry,
  };
};
