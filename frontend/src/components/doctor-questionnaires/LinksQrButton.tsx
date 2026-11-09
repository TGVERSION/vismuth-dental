'use client';

import { useCallback, useRef, useState } from 'react';
import { LinksQrModal } from './LinksQrModal';
import { useMyClinic } from '@/hooks/useMyClinic';
import { copyText } from '@/lib/clipboard';

/**
 * «Ссылки и QR-код» — открывает окно со ссылками анкеты пациента врача и
 * клиники. При закрытии окна фокус возвращается на кнопку.
 */
export const LinksQrButton = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const { clinic } = useMyClinic();
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
        Создать ссылку для пациента
      </button>

      {clinic?.clinic_public_url && (
        <div className="mt-2 space-y-1">
          <span className="text-xs text-[#8B8B8B]">Ссылка клиники</span>
          <div className="flex min-w-0 items-center gap-2">
            <input
              readOnly
              value={clinic.clinic_public_url}
              aria-label="Быстрая ссылка клиники"
              onFocus={(event) => event.target.select()}
              className="vismuth-input min-w-0 flex-1 text-sm"
            />
            <button
              type="button"
              className="vismuth-function-button text-sm"
              onClick={() => {
                void copyText(clinic.clinic_public_url)
                  .then(() => {
                    setCopied(true);
                    setCopyError('');
                  })
                  .catch(() =>
                    setCopyError('Выделите ссылку и скопируйте вручную.'),
                  );
              }}
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          {copyError && (
            <p role="alert" className="text-xs text-red-600">
              {copyError}
            </p>
          )}
        </div>
      )}

      {open ? <LinksQrModal onClose={close} /> : null}
    </>
  );
};
