'use client';

import { useEffect, useRef } from 'react';
import type { DentalProgress } from '@/lib/dental-questionnaire';
import type { ClinicBranding } from '@/lib/questionnaire';
import { ClinicLogo } from '@/components/questionnaire/ClinicLogo';

interface DentalShellProps {
  clinic: ClinicBranding;
  progress: DentalProgress | null;
  children: React.ReactNode;
  /** Кнопки внизу экрана: остаются на месте, пока тело прокручивается. */
  footer?: React.ReactNode;
}

/**
 * Экран стоматологической анкеты: логотип клиники, «Шаг 1 из 2», тело и
 * кнопка внизу. Высота — на весь экран телефона; на десктопе экран живёт
 * в карточке `.q-shell`, как общая анкета.
 *
 * Оболочка монтируется заново на каждом шаге (шаг — ключ компонента), поэтому
 * при появлении она возвращает прокрутку наверх и переводит фокус на
 * заголовок шага: иначе новый шаг открылся бы с середины, а экранный диктор
 * не узнал бы, что шаг сменился.
 */
export const DentalShell = ({ clinic, progress, children, footer }: DentalShellProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="q-screen flex flex-col">
      <header className="flex min-h-[56px] items-center justify-center px-4 py-2">
        <ClinicLogo url={clinic.logo_url} clinicName={clinic.name} />
      </header>

      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {progress
          ? `Анкета перед приёмом. Шаг ${progress.current} из ${progress.total}: ${progress.label}`
          : 'Анкета перед приёмом'}
      </h1>

      {progress ? (
        <div className="flex flex-col gap-1.5 px-5" aria-hidden="true">
          <div className="flex gap-1.5">
            {Array.from({ length: progress.total }, (_, index) => (
              <span
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  index < progress.current ? 'bg-[var(--q-brand)]' : 'bg-[var(--q-surface)]'
                }`}
              />
            ))}
          </div>
          <p className="text-[13px] text-[var(--q-muted)]">
            Шаг {progress.current} из {progress.total} · {progress.label}
          </p>
        </div>
      ) : null}

      <main className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-6">{children}</main>

      {footer ? (
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--q-surface)] bg-[var(--q-bg)] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
};

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
        : 'bg-[color-mix(in_srgb,var(--q-brand)_12%,white)] text-[var(--q-brand)]'
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
