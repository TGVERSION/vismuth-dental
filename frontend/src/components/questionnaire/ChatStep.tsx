'use client';

import { useEffect, useRef } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { useQuestionnaireChat } from '@/hooks/useQuestionnaireChat';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { ChatBubble, TypingIndicator } from './ChatBubble';
import { ChatComposer } from './ChatComposer';
import { ChatProgress } from './ChatProgress';
import { BackIcon } from './icons';

interface ChatStepProps {
  /** Текущий шаг сервера — чатный. */
  step: QuestionnaireStep;
  submit: (
    answer: QuestionnaireStepAnswer,
  ) => Promise<QuestionnaireStep | null>;
  isSubmitting: boolean;
  submitError: string | null;
  /** Возврат к выбору врача. Не передаётся, когда возвращаться некуда. */
  onBack?: () => void;
}

/**
 * Чат анкеты. Вопросы, быстрые ответы и поле ввода — из шага сервера;
 * переход к данным приёма делает `QuestionnaireApp` по смене экрана шага.
 */
export const ChatStep = ({
  step,
  submit,
  isSubmitting,
  submitError,
  onBack,
}: ChatStepProps) => {
  const chat = useQuestionnaireChat({ step, submit, isSubmitting });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Высота с учётом клавиатуры: на iOS `100dvh` на неё не реагирует, и поле
  // ввода оказалось бы под клавиатурой. Пока API недоступно — остаёмся
  // на высоте из класса.
  const viewportHeight = useViewportHeight();
  const isDesktop = useIsDesktop();
  // На десктопе чат живёт в карточке фиксированной высоты, и подстройка
  // под клавиатуру там не нужна — она растянула бы карточку на весь экран.
  const keyboardHeight = isDesktop ? null : viewportHeight;

  // Лента всегда показывает последнее сообщение: на телефоне с открытой
  // клавиатурой иначе не видно, на что отвечать.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.entries.length, chat.isAwaiting, submitError]);

  return (
    <div
      className="q-screen-fixed flex flex-col"
      style={keyboardHeight ? { height: `${keyboardHeight}px` } : undefined}
    >
      <header className="flex shrink-0 items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-3">
        {onBack ? (
          // Пока ассистент отвечает, возврат недоступен: иначе поздний ответ
          // прежней анкеты пришёл бы уже после выбора другого врача.
          <button
            type="button"
            onClick={onBack}
            disabled={chat.isAwaiting}
            aria-label="Вернуться к выбору врача"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        ) : null}
        <h1 className="text-[24px] font-bold">Чат с Ассистентом</h1>
      </header>

      <div className="shrink-0 px-4 pb-3">
        <ChatProgress value={chat.progress} />
      </div>

      {/* Лента прижата к низу: пока сообщений мало, они стоят над полем
          ввода, а не висят под шапкой, и диалог растёт вверх — как в
          привычном мессенджере.
          Прижимает внутренний блок `mt-auto`, а не `justify-end` на
          контейнере: когда переписка перестаёт помещаться, автоотступ
          обращается в ноль и прокрутка работает обычным образом, тогда как
          `justify-end` в прокручиваемом контейнере делает начало ленты
          недостижимым. */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div className="mt-auto space-y-3">
          {/* Служебная плашка, как в мессенджерах: стоит над первым вопросом
              и уезжает вверх вместе с перепиской, места не занимает. */}
          <p className="text-center text-sm text-[var(--q-muted)]">
            Ответы увидит только ваш врач
          </p>

          {chat.entries.map((entry) => (
            <ChatBubble key={entry.id} author={entry.kind}>
              {entry.text}
            </ChatBubble>
          ))}

          {chat.isAwaiting ? <TypingIndicator hint={chat.waitHint} /> : null}

          {submitError ? (
            <div role="alert" className="rounded-2xl bg-[var(--q-surface)] p-3">
              <p className="text-sm">{submitError}</p>
              <button
                type="button"
                onClick={chat.retry}
                className="mt-2 min-h-[44px] rounded-xl bg-[var(--q-brand)] px-4 text-sm font-medium text-[var(--q-brand-contrast)]"
              >
                Повторить
              </button>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      <ChatComposer
        prompt={chat.prompt}
        isAwaiting={chat.isAwaiting}
        onAction={chat.send}
      />
    </div>
  );
};
