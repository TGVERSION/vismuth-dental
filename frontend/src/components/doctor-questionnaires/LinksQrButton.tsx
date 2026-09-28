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
        className="h-13 w-full shrink-0 cursor-pointer rounded-xl bg-white px-6 text-[#5D8CF1] transition-colors hover:bg-[#F0F5FF]"
      >
        Ссылки и QR-код
      </button>

      {open ? <LinksQrModal onClose={close} /> : null}
    </>
  );
};
