'use client';

import { Fragment, useEffect, useRef } from 'react';
import type { QuestionnaireStep } from '@/api';
import type { DentalProgress } from '@/lib/dental-questionnaire';
import type { ClinicBranding } from '@/lib/questionnaire';
import { ChatProgress } from '@/components/questionnaire/ChatProgress';
import { ClinicLogo } from '@/components/questionnaire/ClinicLogo';
import { ChatBubble } from '@/components/questionnaire/ChatBubble';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useIsDesktop } from '@/hooks/useIsDesktop';

interface DentalShellProps {
  clinic: ClinicBranding;
  progress: DentalProgress | null;
  activeKey?: string;
  history?: NonNullable<QuestionnaireStep['dental']>['history'];
  intro?: React.ReactNode;
  children: React.ReactNode;
  /** Кнопки внизу экрана: остаются на месте, пока тело прокручивается. */
  footer?: React.ReactNode;
}

/**
 * Та же переписка, что в общей анкете. История только для чтения и только
 * из принятых сервером ответов. Текущая группа остаётся одним ответом:
 * оформление чата не увеличивает число запросов и нажатий.
 */
export const DentalShell = ({
  clinic,
  progress,
  activeKey,
  history = [],
  intro,
  children,
  footer,
}: DentalShellProps) => {
  const listRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();
  const isDesktop = useIsDesktop();
  const viewportFit = isDesktop ? null : viewport;

  useEffect(() => {
    const list = listRef.current;
    const current = currentRef.current;
    if (!list || !current) return;
    // Показываем начало активного вопроса, а не конец длинного списка.
    // Предыдущая реплика видна, если для неё остаётся место. Длинный список
    // начинается с самого вопроса, без обрезанной полоски прошлого пузыря.
    const freeSpace =
      list.clientHeight - current.getBoundingClientRect().height - 16;
    const historyPeek =
      history.length && freeSpace >= 56 ? Math.min(72, freeSpace) : 0;
    list.scrollTop +=
      current.getBoundingClientRect().top -
      list.getBoundingClientRect().top -
      historyPeek;
    const question = current.querySelector<HTMLElement>('h2') ?? current;
    question.setAttribute('tabindex', '-1');
    // Постоянный редактор внизу сохраняет фокус и экранную клавиатуру.
    if (!document.activeElement?.matches('textarea[aria-label="Ваш ответ"]'))
      question.focus({ preventScroll: true });
    const revealField = () => {
      const field = document.activeElement;
      if (field instanceof HTMLElement && field.matches('textarea[aria-label="Ваш ответ"]')) {
        // Редактор закреплён вне ленты. При открытии клавиатуры лента
        // сжимается: сохраняем в ней активный вопрос, а не старую историю.
        list.scrollTop += current.getBoundingClientRect().top - list.getBoundingClientRect().top;
        return;
      }
      if (
        !(field instanceof HTMLElement) ||
        !current.contains(field) ||
        !field.matches('input, textarea')
      )
        return;
      const bounds = list.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      if (rect.bottom > bounds.bottom - 12)
        list.scrollTop += rect.bottom - bounds.bottom + 12;
      else if (rect.top < bounds.top + 12)
        list.scrollTop += rect.top - bounds.top - 12;
    };
    const observer = new ResizeObserver(revealField);
    observer.observe(list);
    list.addEventListener('focusin', revealField);
    return () => {
      observer.disconnect();
      list.removeEventListener('focusin', revealField);
    };
    // Оболочка монтируется заново вместе с каждым шагом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return (
    <div
      className="q-screen-fixed flex min-w-0 flex-col bg-[var(--q-bg)]"
      style={
        viewportFit
          ? {
              height: `${viewportFit.height}px`,
              transform: `translateY(${viewportFit.offsetTop}px)`,
            }
          : undefined
      }
    >
      <header className="flex shrink-0 flex-col items-start gap-1 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <h1 className="text-[24px] font-bold">Чат с Ассистентом</h1>
        <div className="max-w-full text-sm text-[var(--q-muted)]">
          {clinic.logo_url ? (
            <ClinicLogo url={clinic.logo_url} clinicName={clinic.name} />
          ) : (
            clinic.name
          )}
        </div>
      </header>

      {progress ? (
        <div className="flex shrink-0 items-center gap-3 px-4 pb-3">
          {/* Тот же индикатор, что в чате общей анкеты. */}
          <div className="min-w-0 flex-1">
            <ChatProgress value={progress.current / progress.total} />
          </div>
          <p
            className="shrink-0 text-[13px] text-[var(--q-muted)]"
            aria-label={`Шаг ${progress.current} из ${progress.total}: ${progress.label}`}
          >
            {progress.current} из {progress.total}
          </p>
        </div>
      ) : null}

      <main
        ref={listRef}
        aria-label="Переписка с Ассистентом"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 max-md:overscroll-contain"
      >
        <div className="mt-auto space-y-3">
          {intro}
          {history.map((entry) => (
            <Fragment key={entry.id}>
              <ChatBubble author="assistant">{entry.question}</ChatBubble>
              <ChatBubble author="patient">{entry.answer}</ChatBubble>
            </Fragment>
          ))}
          <div
            ref={currentRef}
            className="flex min-w-0 flex-col gap-4"
            tabIndex={-1}
          >
            {children}
          </div>
        </div>
      </main>

      {footer ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--q-surface)] bg-[var(--q-bg)] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
};

/** Входящее сообщение с доступной разметкой вопроса, без вложенных <p>. */
export const DentalAssistantMessage = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="min-w-0 max-w-[92%] self-start rounded-2xl rounded-bl-md bg-[var(--q-bubble-in)] px-4 py-3">
    {children}
  </div>
);

interface DentalButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  /** Ответ отправляется: кнопка заблокирована, вместо текста — крутилка. */
  isBusy?: boolean;
  /** Мягкая кнопка: «Ничего из этого нет». */
  variant?: 'primary' | 'soft';
}

export const DentalButton = ({
  children,
  onClick,
  isBusy = false,
  variant = 'primary',
}: DentalButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isBusy}
    aria-busy={isBusy}
    className={`flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-base font-semibold disabled:opacity-60 ${
      variant === 'primary'
        ? 'bg-[var(--q-brand)] text-[var(--q-brand-contrast)]'
        : 'bg-[var(--q-surface)] text-[var(--q-brand)]'
    }`}
  >
    {isBusy ? (
      <>
        {/* Цвет крутилки — цвет текста кнопки: на мягкой кнопке белая
            крутилка общей анкеты не видна. */}
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-b-transparent"
        />
        <span className="sr-only">Отправляем…</span>
      </>
    ) : (
      children
    )}
  </button>
);

/** Ошибка отправки под кнопкой. */
export const DentalError = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="text-sm text-[#C2334D]">
      {message}
    </p>
  ) : null;
