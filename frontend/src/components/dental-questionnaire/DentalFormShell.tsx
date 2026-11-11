'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuestionnaireStep } from '@/api';
import { dentalFormStage } from '@/lib/dental-questionnaire';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useIsDesktop } from '@/hooks/useIsDesktop';

interface Props {
  step: QuestionnaireStep;
  children: React.ReactNode;
  footer: React.ReactNode;
  onBack?: () => void;
  busy: boolean;
}

/** Одна область прокрутки; основной переход закреплён внизу экрана. */
export const DentalFormShell = ({
  step,
  children,
  footer,
  onBack,
  busy,
}: Props) => {
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const stage = dentalFormStage(step);
  const viewport = useVisualViewport();
  const isDesktop = useIsDesktop();
  const fit = isDesktop ? null : viewport;

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    main.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step.step_key]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const revealFocused = () => {
      const field = document.activeElement;
      if (
        !(field instanceof HTMLElement) ||
        !main.contains(field) ||
        !field.matches('input, textarea')
      )
        return;
      const bounds = main.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      if (rect.bottom > bounds.bottom - 12)
        main.scrollTop += rect.bottom - bounds.bottom + 12;
      else if (rect.top < bounds.top + 12)
        main.scrollTop += rect.top - bounds.top - 12;
    };
    const observer = new ResizeObserver(revealFocused);
    observer.observe(main);
    main.addEventListener('focusin', revealFocused);
    return () => {
      observer.disconnect();
      main.removeEventListener('focusin', revealFocused);
    };
  }, [step.step_key]);

  useEffect(() => {
    const main = mainRef.current;
    const content = contentRef.current;
    const end = endRef.current;
    if (!main || !content || !end) return;
    const measure = () => {
      setMoreBelow(
        end.getBoundingClientRect().bottom >
          main.getBoundingClientRect().bottom + 2,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    observer.observe(content);
    main.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      main.removeEventListener('scroll', measure);
    };
  }, [step.step_key]);

  return (
    <div
      className="q-screen-fixed flex min-w-0 flex-col bg-[var(--q-bg)]"
      style={
        fit
          ? {
              height: `${fit.height}px`,
              transform: `translateY(${fit.offsetTop}px)`,
            }
          : undefined
      }
    >
      <header className="shrink-0 border-b border-[var(--q-surface)] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              aria-label="Назад"
              title="Назад"
              disabled={busy}
              onClick={onBack}
              className="q-icon-button flex shrink-0 items-center justify-center text-[var(--q-text)]"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M19 12H5m7-7-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          <ol
            aria-label="Этапы анкеты"
            className="grid min-w-0 flex-1 grid-cols-4 gap-2"
          >
            {['Обращение', 'Здоровье', 'Уточнения', 'О вас'].map(
              (label, index) => (
                <li
                  key={label}
                  className="min-w-0 break-words"
                  aria-current={
                    stage.current === index + 1 ? 'step' : undefined
                  }
                >
                  <div
                    aria-hidden="true"
                    className={`mb-2 h-1 rounded-full ${index + 1 <= stage.current ? 'bg-[var(--q-brand)]' : 'bg-[var(--q-surface)]'}`}
                  />
                  <span
                    className={`block text-xs ${stage.current === index + 1 ? 'font-semibold text-[var(--q-text)]' : 'text-[var(--q-muted)]'}`}
                  >
                    {label}
                  </span>
                </li>
              ),
            )}
          </ol>
        </div>
      </header>
      <main
        ref={mainRef}
        aria-label="Раздел анкеты"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]"
      >
        <div ref={contentRef} className="flex min-w-0 flex-col gap-6 pt-6">
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl leading-tight font-semibold outline-none"
            >
              {step.step_key === 'dental_reason'
                ? 'Повод визита'
                : step.step_key.startsWith('dental_details_allergy')
                  ? step.step_key.endsWith('_reaction')
                    ? 'Проявления аллергии'
                    : 'На что была аллергия'
                  : (step.title ?? stage.title)}
            </h1>
          </div>
          {children}
          <div ref={endRef} data-dental-fields-end aria-hidden="true" />
        </div>
      </main>
      <div
        className={`pointer-events-none shrink-0 bg-[var(--q-bg)] px-4 py-2 text-center text-sm text-[var(--q-muted)] ${moreBelow ? '' : 'hidden'}`}
        role="status"
      >
        <span aria-hidden="true">↓ </span>Ниже ещё есть пункты
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--q-surface)] bg-[var(--q-bg)] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {footer}
      </div>
    </div>
  );
};

export const DentalFormHeading = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="min-w-0">{children}</div>;
