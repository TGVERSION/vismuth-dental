'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mainApi } from '@/api';
import type { QuestionnaireAnswer, QuestionnaireMessage } from '@/api';
import { isAbortError } from '@/api/base-client';
import { logError } from '@/lib/logger';
import { estimateProgress } from '@/lib/questionnaire';

/** Через сколько подсказывать пациенту, что ассистент ещё думает. */
const HINT_THINKING_MS = 15_000;
const HINT_LONGER_MS = 45_000;

export type ChatEntry =
  | { kind: 'assistant'; id: string; message: QuestionnaireMessage }
  | { kind: 'patient'; id: string; text: string };

export interface UseQuestionnaireChatResult {
  entries: ChatEntry[];
  /** Последнее сообщение ассистента: по нему строятся чипы и поле ввода. */
  current: QuestionnaireMessage | null;
  isAwaiting: boolean;
  waitHint: string | null;
  error: string | null;
  finished: boolean;
  /** Хотя бы раз ассистент ответил без ИИ — врач увидит пометку. */
  aiUnavailable: boolean;
  /** Доля пройденного от 0 до 1 для индикатора. */
  progress: number;
  send: (text: string) => void;
  retry: () => void;
}

/**
 * Диалог пациента с ассистентом.
 *
 * Ожидание ответа может дойти до трёх минут: backend ждёт ml-service до 180 с.
 * Запрос при этом не обрывается по своему таймеру — сервер всё равно его
 * досчитает, и повторная отправка создала бы дубль сообщения и лишний раз
 * израсходовала лимит уточняющих. Вместо этого пациенту показываются
 * подсказки об ожидании.
 */
export const useQuestionnaireChat = (
  sessionId: string,
  initialMessage: QuestionnaireMessage,
): UseQuestionnaireChatResult => {
  const [entries, setEntries] = useState<ChatEntry[]>(() => [
    { kind: 'assistant', id: initialMessage.id, message: initialMessage },
  ]);
  const [current, setCurrent] = useState<QuestionnaireMessage | null>(
    initialMessage,
  );
  const [isAwaiting, setIsAwaiting] = useState(false);
  const [waitHint, setWaitHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(initialMessage.finished);
  const [aiUnavailable, setAiUnavailable] = useState(
    initialMessage.ai_unavailable,
  );

  const abortRef = useRef<AbortController | null>(null);
  // Последний отправленный ответ: нужен, чтобы «Повторить» не добавляло
  // второй пузырь пациента в ленту.
  const lastAnswerRef = useRef<QuestionnaireAnswer | null>(null);
  const isAwaitingRef = useRef(false);

  // Незавершённый запрос отменяем при уходе с экрана, иначе состояние
  // размонтированного компонента обновится из обработчика ответа.
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Подсказки об ожидании. Таймеры живут только пока идёт запрос.
  useEffect(() => {
    if (!isAwaiting) {
      setWaitHint(null);
      return;
    }

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
    };
  }, [isAwaiting]);

  const ask = useCallback(
    async (answer: QuestionnaireAnswer) => {
      // Защита от повторного запуска: второй тап по «отправить» не должен
      // уходить вторым запросом.
      if (isAwaitingRef.current) return;

      isAwaitingRef.current = true;
      setIsAwaiting(true);
      setError(null);
      lastAnswerRef.current = answer;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const message = await mainApi.questionnaire.sendAnswer(
          sessionId,
          answer,
          { signal: controller.signal },
        );

        setEntries((prev) => [
          ...prev,
          { kind: 'assistant', id: message.id, message },
        ]);
        setCurrent(message);
        setFinished(message.finished);
        if (message.ai_unavailable) setAiUnavailable(true);
        lastAnswerRef.current = null;
      } catch (caught) {
        if (isAbortError(caught)) return;

        // Наружу — только общее сообщение: в ответе сервера могут быть
        // служебные подробности, пациенту они не нужны.
        logError('Анкета: ошибка отправки ответа', caught);
        setError('Не удалось отправить ответ. Попробуйте ещё раз.');
      } finally {
        isAwaitingRef.current = false;
        setIsAwaiting(false);
        abortRef.current = null;
      }
    },
    [sessionId],
  );

  const send = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) return;
      // Проверка та же, что в `ask`, но выполняется до записи в ленту:
      // иначе при двойном нажатии `ask` вышел бы по своему guard'у, а пузырь
      // пациента уже остался бы в переписке — ответ, который никуда не ушёл.
      // Блокировки кнопок недостаточно: isAwaiting обновляется асинхронно.
      if (isAwaitingRef.current) return;

      setEntries((prev) => [
        ...prev,
        { kind: 'patient', id: `patient-${prev.length}`, text: value },
      ]);
      void ask({ text: value });
    },
    [ask],
  );

  const retry = useCallback(() => {
    const answer = lastAnswerRef.current;
    if (!answer) return;

    // Пузырь пациента уже в ленте — повторяем только запрос.
    void ask(answer);
  }, [ask]);

  // Прогресс считает сервер: только он знает остаток бюджета уточняющих.
  // Своя оценка — запасной вариант, пока поля нет в ответе.
  const answered = entries.filter((entry) => entry.kind === 'patient').length;
  const progress = current?.progress ?? estimateProgress(answered, finished);

  return {
    entries,
    current,
    progress,
    isAwaiting,
    waitHint,
    error,
    finished,
    aiUnavailable,
    send,
    retry,
  };
};
