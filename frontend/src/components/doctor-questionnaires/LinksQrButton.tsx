'use client';

import { useCallback, useRef, useState } from 'react';
import { LinksQrModal } from './LinksQrModal';

/**
 * Открывает форму ссылки пациента и возвращает фокус при закрытии.
 */
export const LinksQrButton = () => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="vismuth-button w-full shrink-0 bg-white! hover:bg-[var(--ui-color-blue-50)]!"
        data-variant="ghost"
        data-size="l"
      >
        Новая ссылка для пациента
      </button>

      {open ? <LinksQrModal onClose={close} /> : null}
    </>
  );
};
