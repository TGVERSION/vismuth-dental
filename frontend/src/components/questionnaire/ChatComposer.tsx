'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ANSWER_MAX_LENGTH, clampAnswer } from '@/lib/questionnaire';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { SendIcon } from './icons';

/** До скольких строк растёт поле ввода, прежде чем начать прокручиваться. */
const MAX_INPUT_LINES = 6;

interface ChatComposerProps {
  quickReplies: string[] | null;
  isAwaiting: boolean;
  onSend: (text: string) => void;
}

/**
 * Нижняя панель чата: быстрые ответы и поле ввода.
 *
 * Поле ввода показывается всегда, даже когда сервер прислал варианты ответа
 * (`input: 'choice'`). Быстрые ответы — подсказка, а не ограничение: пациент
 * может ответить своими словами на любой вопрос. Заодно это снимает риск
 * запереть его без единого способа ответить, если отправка перестала
 * проходить.
 */
export const ChatComposer = ({
  quickReplies,
  isAwaiting,
  onSend,
}: ChatComposerProps) => {
  const [value, setValue] = useState('');
  const [truncated, setTruncated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDesktop = useIsDesktop();
  // Касался ли пациент поля хоть раз. На телефоне это важно: автофокус до
  // первого касания выдвинул бы клавиатуру сразу при входе в чат и закрыл
  // собой вопрос ассистента.
  const hasTouchedInputRef = useRef(false);

  const canSend = value.trim().length > 0 && !isAwaiting;

  /**
   * Поле растёт по мере ввода и перестаёт на шести строках, дальше
   * прокручивается.
   *
   * Предел считается от фактических межстрочного интервала и отступов, а не
   * задан числом в пикселях: иначе при смене шрифта или масштаба текста
   * в системе поле обрезало бы шестую строку.
   */
  const resize = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;

    const styles = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const padding =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom);
    const maxHeight = lineHeight * MAX_INPUT_LINES + padding;

    // Сброс обязателен: без него scrollHeight не уменьшается при удалении
    // текста, и поле, раз выросши, больше не сжимается.
    element.style.height = 'auto';
    const needed = element.scrollHeight;

    element.style.height = `${Math.min(needed, maxHeight)}px`;
    element.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  }, []);

  // После отрисовки: в этот момент значение в DOM совпадает с состоянием,
  // в том числе когда ввод обрезан по длине.
  useEffect(() => {
    resize();
  }, [value, resize]);

  /**
   * Фокус возвращается в поле, как только ассистент ответил, — чтобы можно
   * было печатать дальше, не целясь в поле после каждого сообщения.
   *
   * На десктопе это работает сразу: фокус там ничего не загораживает.
   * На телефоне — только после того, как пациент сам коснулся поля: иначе
   * клавиатура выехала бы при входе в чат.
   *
   * Пока ответ не пришёл, поле отключено, и фокус всё равно не встал бы;
   * эффект срабатывает ровно в момент, когда оно снова доступно.
   */
  useEffect(() => {
    if (isAwaiting) return;
    if (!isDesktop && !hasTouchedInputRef.current) return;

    textareaRef.current?.focus();
  }, [isAwaiting, isDesktop]);

  const handleChange = (raw: string) => {
    const { value: next, truncated: wasTruncated } = clampAnswer(raw);
    setValue(next);
    setTruncated(wasTruncated);
  };

  const submit = () => {
    if (!canSend) return;

    onSend(value);
    setValue('');
    setTruncated(false);
  };

  return (
    <div className="bg-[var(--q-bg)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      {/* Быстрые ответы прижаты вправо, к стороне ответов пациента: так
          видно, что это его реплика, а не продолжение вопроса. */}
      {quickReplies?.length ? (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => onSend(reply)}
              disabled={isAwaiting}
              className="min-h-[44px] rounded-xl bg-[var(--q-surface)] px-4 text-base disabled:opacity-60"
            >
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-2xl bg-[var(--q-surface)] px-4 py-1"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onFocus={() => {
            hasTouchedInputRef.current = true;
          }}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter отправляет, Shift+Enter — перенос строки.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={isAwaiting}
          placeholder="Сообщение"
          aria-label="Ваш ответ"
          // Высоту и прокрутку задаёт resize(): в классах их нет, иначе
          // они перебивались бы и предел в шесть строк не соблюдался.
          className="custom-scrollbar flex-1 resize-none bg-transparent py-3 text-base leading-6 outline-none disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Отправить"
          className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--q-brand)] disabled:opacity-40"
        >
          <SendIcon className="h-6 w-6" />
        </button>
      </form>

      {truncated ? (
        <p className="mt-2 text-xs text-[var(--q-muted)]">
          Ответ сокращён до {ANSWER_MAX_LENGTH} символов.
        </p>
      ) : null}
    </div>
  );
};
