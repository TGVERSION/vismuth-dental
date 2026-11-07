'use client';

import { useEffect, useRef } from 'react';
import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { useQuestionnaireChat } from '@/hooks/useQuestionnaireChat';
import { useVisualViewport } from '@/hooks/useVisualViewport';
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
  const listRef = useRef<HTMLDivElement | null>(null);
  // Сколько ленты осталось ниже видимой части. Запоминается при прокрутке,
  // чтобы после изменения высоты ленты вернуть её в то же положение
  // относительно низа.
  const bottomGapRef = useRef(0);
  // Видимая область с учётом клавиатуры: на iOS `100dvh` на неё не
  // реагирует, а сама область при открытии клавиатуры ещё и сдвигается вниз.
  // Экран совмещается с ней по высоте и по сдвигу, иначе поле ввода висит
  // над клавиатурой. Пока API недоступно или страница увеличена жестом —
  // остаёмся на высоте из класса.
  const visualViewport = useVisualViewport();
  const isDesktop = useIsDesktop();
  // На десктопе чат живёт в карточке фиксированной высоты, и подстройка
  // под клавиатуру там не нужна — она растянула бы карточку на весь экран.
  const viewportFit = isDesktop ? null : visualViewport;

  // Лента всегда показывает последнее сообщение: на телефоне с открытой
  // клавиатурой иначе не видно, на что отвечать.
  // Прокручивается сама лента, а не scrollIntoView: тот двигает и страницу,
  // а на iOS при открытой клавиатуре это сдвигает весь экран чата.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    list.scrollTop = list.scrollHeight;
  }, [chat.entries.length, chat.isAwaiting, submitError]);

  // Лента привязана к низу, как в мессенджере. Когда выезжает клавиатура
  // (или растёт поле ввода), лента становится ниже, а браузер сохраняет
  // отступ от верха — и последний вопрос уходит под клавиатуру. Поэтому
  // после каждого изменения высоты восстанавливаем отступ от низа: кто был
  // в конце переписки, в конце и остаётся, а кто листал историю — видит то же
  // место.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const observer = new ResizeObserver(() => {
      list.scrollTop =
        list.scrollHeight - list.clientHeight - bottomGapRef.current;
    });
    observer.observe(list);

    return () => observer.disconnect();
  }, []);

  const rememberBottomGap = () => {
    const list = listRef.current;
    if (!list) return;

    bottomGapRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight;
  };

  return (
    <div
      // Свой фон обязателен: на телефоне экран закреплён поверх страницы,
      // и без фона под лентой проступало бы то, что лежит за ним.
      className="q-screen-fixed flex flex-col bg-[var(--q-bg)]"
      style={
        viewportFit
          ? {
              height: `${viewportFit.height}px`,
              transform: `translateY(${viewportFit.offsetTop}px)`,
            }
          : undefined
      }
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
            className="q-icon-button -ml-2 flex shrink-0 items-center justify-center disabled:opacity-40"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        ) : null}
        <h1 className="text-[length:var(--ui-font-size-26)] font-bold">
          Чат с Ассистентом
        </h1>
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
          недостижимым.
          `overscroll-contain`: когда лента докручена до края, жест не
          переходит на страницу. На iOS с открытой клавиатурой он сдвинул
          бы видимую область, и экран чата дёргался бы вслед за ней.
          Только на телефоне: в десктопной карточке прокрутка должна
          переходить на страницу, иначе на невысоком окне до поля ввода не
          докрутить колесом. */}
      <div
        ref={listRef}
        onScroll={rememberBottomGap}
        className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 max-md:overscroll-contain"
      >
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
                className="q-button mt-2"
              >
                Повторить
              </button>
            </div>
          ) : null}
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
