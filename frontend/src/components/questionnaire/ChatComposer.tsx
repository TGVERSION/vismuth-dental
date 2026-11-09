'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ANSWER_MAX_LENGTH,
  CHOOSE_OPTION_HINT,
  COMMENT_WITH_CHOICE_HINT,
  clampAnswer,
  type ChatAction,
  type ChatChip,
  type ChatPrompt,
} from '@/lib/questionnaire';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { SendIcon } from './icons';
import { PatientVoiceInput } from './PatientVoiceInput';

/** До скольких строк растёт поле ввода, прежде чем начать прокручиваться. */
const MAX_INPUT_LINES = 6;

interface ChatComposerProps {
  prompt: ChatPrompt;
  isAwaiting: boolean;
  onAction: (action: ChatAction) => void;
}

const chipKey = (chip: ChatChip): string =>
  chip.kind === 'specialization'
    ? `specialization-${chip.id}`
    : chip.kind === 'none'
      ? 'none'
      : `${chip.kind}-${chip.value}`;

/**
 * Нижняя панель чата: быстрые ответы и поле ввода.
 *
 * Быстрый ответ отправляется сразу по нажатию. Поле ввода видно всегда
 * (решение 3). Где backend текст не принимает (шаги `choice`, ВЗ-6), оно
 * заблокировано с подсказкой выбрать вариант; на «Что изменилось» текст из
 * поля уходит необязательным комментарием вместе с нажатым вариантом.
 *
 * Компонент не перемонтируется при смене вопроса: иначе сбросился бы признак
 * касания поля, и на телефоне после каждого ответа пропадала бы клавиатура.
 */
export const ChatComposer = ({
  prompt,
  isAwaiting,
  onAction,
}: ChatComposerProps) => {
  const [value, setValue] = useState('');
  const [truncated, setTruncated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const isDesktop = useIsDesktop();
  // Касался ли пациент поля хоть раз. На телефоне это важно: автофокус до
  // первого касания выдвинул бы клавиатуру сразу при входе в чат и закрыл
  // собой вопрос ассистента.
  const hasTouchedInputRef = useRef(false);

  const isLocked = prompt.input === 'locked';
  const withChoice = prompt.input === 'with_choice';
  const hint = isLocked
    ? CHOOSE_OPTION_HINT
    : withChoice
      ? COMMENT_WITH_CHOICE_HINT
      : null;

  // С комментарием к варианту отправляет сам вариант, кнопка — только текст.
  const canSend =
    !isAwaiting && prompt.input === 'text' && value.trim().length > 0;

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
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
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
   * На телефоне это запасной путь: iOS не открывает клавиатуру по `focus()`
   * без касания. Основное — не терять фокус вовсе: поле не отключается на
   * время ожидания, а кнопки его не забирают (см. `keepInputFocus`). Эффект
   * нужен, когда поле всё-таки было отключено — на вопросе с выбором.
   */
  useEffect(() => {
    if (isAwaiting) return;
    if (!isDesktop && !hasTouchedInputRef.current) return;

    textareaRef.current?.focus();
  }, [isAwaiting, isDesktop]);

  /**
   * Нажатие на кнопку не уводит фокус из поля ввода. Иначе на телефоне
   * клавиатура закрывалась бы после каждой отправки и после каждого быстрого
   * ответа, а открыть её обратно программно iOS не даёт. Клик при этом
   * срабатывает как обычно.
   */
  const keepInputFocus = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const handleChange = (raw: string) => {
    const { value: next, truncated: wasTruncated } = clampAnswer(raw);
    setValue(next);
    setTruncated(wasTruncated);
  };

  const clearInput = () => {
    setValue('');
    setTruncated(false);
  };

  const submit = () => {
    if (!canSend) return;

    onAction({ type: 'text', text: value });
    clearInput();
  };

  const handleChip = (chip: ChatChip) => {
    switch (chip.kind) {
      case 'choice':
        onAction({ type: 'choice', value: chip.value });
        return;
      case 'none':
        onAction({ type: 'none' });
        return;
      case 'specialization':
        onAction({ type: 'specialization', id: chip.id });
        return;
      case 'select':
        onAction({ type: 'choice_text', value: chip.value, text: value });
        clearInput();
        return;
    }
  };

  return (
    // Снизу — запас под индикатор «домой», но только без фокуса в поле.
    // Safari не обнуляет safe-area при открытой клавиатуре, хотя индикатор
    // под ней не виден, и над клавиатурой оставалась бы пустая полоса.
    // Фокус в поле на телефоне и есть открытая клавиатура: кнопки его не
    // забирают, а на шагах с выбором поле отключено. Условие — фокус
    // именно в поле, а не где-то в панели: кнопка в фокусе (Tab с внешней
    // клавиатуры) экранную клавиатуру не открывает.
    <div className="bg-[var(--q-bg)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] has-[textarea:focus]:pb-3">
      {/* Быстрые ответы прижаты вправо, к стороне ответов пациента: так
          видно, что это его реплика, а не продолжение вопроса.
          Чип контурный и полностью скруглён: с серой заливкой и скруглением
          пузыря он выглядел как уже отправленное сообщение. При нажатии
          заливается цветом бренда — как ответ, который появится в ленте. */}
      {!isAwaiting && prompt.chips.length ? (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {prompt.chips.map((chip) => (
            <button
              key={chipKey(chip)}
              type="button"
              onMouseDown={keepInputFocus}
              onClick={() => handleChip(chip)}
              disabled={isAwaiting}
              className="min-h-[44px] rounded-full border border-[var(--q-accent)] bg-[var(--q-bg)] px-4 text-base text-[var(--q-accent)] transition-colors active:bg-[var(--q-brand)] active:text-[var(--q-brand-contrast)] disabled:opacity-60"
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      {!isLocked && (
        <PatientVoiceInput
          value={value}
          onChange={handleChange}
          disabled={isAwaiting}
          maxLength={ANSWER_MAX_LENGTH}
          scope={`${prompt.stepKey}:${prompt.text}`}
        />
      )}
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
          // Пока ассистент отвечает, поле не отключается: отключённое поле
          // теряет фокус, и клавиатура закрывалась бы между вопросами.
          // Отправку на это время блокирует canSend, а пока ответа нет,
          // пациент может начать печатать.
          disabled={isLocked}
          placeholder="Сообщение"
          aria-label="Ваш ответ"
          aria-describedby={hint ? hintId : undefined}
          // Высоту и прокрутку задаёт resize(): в классах их нет, иначе
          // они перебивались бы и предел в шесть строк не соблюдался.
          // Шрифт не меньше 16px (`text-base`): мельче iOS при фокусе
          // масштабирует страницу, и подстройка экрана под клавиатуру
          // выключается (см. useVisualViewport).
          className="q-chat-input custom-scrollbar min-w-0 flex-1 resize-none bg-transparent py-3 text-base outline-none disabled:opacity-60"
        />

        <button
          type="submit"
          onMouseDown={keepInputFocus}
          disabled={!canSend}
          aria-label="Отправить"
          className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--q-accent)] disabled:opacity-40"
        >
          <SendIcon className="h-6 w-6" />
        </button>
      </form>

      {hint ? (
        <p id={hintId} className="mt-2 text-xs text-[var(--q-muted)]">
          {hint}
        </p>
      ) : null}

      {truncated ? (
        <p className="mt-2 text-xs text-[var(--q-muted)]">
          Ответ сокращён до {ANSWER_MAX_LENGTH} символов.
        </p>
      ) : null}
    </div>
  );
};
