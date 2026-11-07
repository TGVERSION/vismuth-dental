'use client';

import Image from 'next/image';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  /** Пока идёт запрос, закрыть окно нельзя. */
  closeDisabled?: boolean;
  children: ReactNode;
}

/**
 * Прокручиваемые контейнеры, которые блокируются, пока открыта модалка
 * (окно настроек помечено этим атрибутом).
 */
export const SCROLL_LOCK_ATTR = 'data-modal-scroll-lock';

/**
 * Модальное окно поверх окна настроек, в стиле подтверждения удаления.
 *
 * Рендерится порталом в `body`: у оверлея настроек есть `backdrop-filter`,
 * а такой элемент становится контейнером для `position: fixed` потомков —
 * внутри него модалка затемняла бы только его область и прокручивалась
 * вместе с ним.
 */
export const ModalShell = ({
  title,
  onClose,
  closeDisabled = false,
  children,
}: ModalShellProps) => {
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(`[${SCROLL_LOCK_ATTR}]`),
    );
    const previous = targets.map((element) => element.style.overflow);
    targets.forEach((element) => {
      element.style.overflow = 'hidden';
    });

    return () => {
      targets.forEach((element, index) => {
        element.style.overflow = previous[index];
      });
    };
  }, []);

  useEffect(() => {
    if (closeDisabled) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // Esc в открытом выпадающем списке закрывает список, а не модалку:
      // список рендерится порталом и существует только открытым.
      if (document.querySelector('[role="listbox"]')) return;
      onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeDisabled, onClose]);

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-[var(--ui-z-modal)] flex items-center justify-center overscroll-contain bg-[color:var(--ui-color-alabaster-dark-800)]/20"
      onClick={() => !closeDisabled && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-in relative flex max-h-[calc(100dvh-32px)] w-141.25 max-w-[calc(100vw-32px)] flex-col overflow-y-auto rounded-2xl bg-white px-6 py-8 shadow-[var(--ui-shadow)] sm:px-10 sm:py-10"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Закрыть"
          className="vismuth-icon-button absolute top-4 right-4"
        >
          <Image alt="" src="/close.svg" width={24} height={24} />
        </button>
        <h2 className="mb-3 pr-10 text-[length:var(--ui-font-size-34)] font-medium text-[var(--ui-color-alabaster-dark-800)]">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export const PRIMARY_BUTTON_CLASS =
  'vismuth-button vismuth-button--primary w-full';

export const SECONDARY_BUTTON_CLASS =
  'vismuth-button vismuth-button--secondary w-full';

export const DANGER_BUTTON_CLASS =
  'vismuth-button vismuth-button--danger w-full';
