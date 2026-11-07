'use client';

import { useCallback, useRef, useState } from 'react';
import { LinksQrModal } from './LinksQrModal';

/**
 * «Ссылки и QR-код» — открывает окно со ссылками анкеты пациента врача и
 * клиники. При закрытии окна фокус возвращается на кнопку.
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
        className="vismuth-button vismuth-button--secondary w-full shrink-0"
      >
        Ссылки и QR-код
      </button>

      {open ? <LinksQrModal onClose={close} /> : null}
    </>
  );
};
