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
      className="modal-overlay fixed inset-0 flex items-center justify-center overscroll-contain bg-black/40"
      onClick={() => !closeDisabled && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-in relative flex w-141.25 flex-col rounded-[15px] bg-white px-10 py-10 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Закрыть"
          className="absolute top-5 right-5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Image alt="" src="/close.svg" width={25} height={25} />
        </button>
        <h2 className="mb-3 text-[34px] font-medium text-[#202020]">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export const PRIMARY_BUTTON_CLASS =
  'h-12 w-full cursor-pointer rounded-2xl bg-[#5D8CF1] text-base text-white transition-colors hover:bg-[#4A7BE0] disabled:cursor-not-allowed disabled:opacity-60';

export const SECONDARY_BUTTON_CLASS =
  'h-12 w-full cursor-pointer rounded-2xl bg-[#E8EEFF] text-base text-[#202020] transition-colors hover:bg-[#D6E0FF] disabled:cursor-not-allowed disabled:opacity-60';

export const DANGER_BUTTON_CLASS =
  'h-12 w-full cursor-pointer rounded-2xl bg-[#F15D5D] text-base text-white transition-colors hover:bg-[#F26E6E] disabled:cursor-not-allowed disabled:opacity-60';
