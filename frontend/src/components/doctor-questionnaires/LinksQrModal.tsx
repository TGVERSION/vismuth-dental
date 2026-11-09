'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { useMyClinic } from '@/hooks/useMyClinic';
import type { QuestionnaireLinkItem } from '@/lib/questionnaire-links';
import { PatientLinkGenerator } from './PatientLinkGenerator';
import { QrPrintSheet } from './QrPrintSheet';

/**
 * Режим печати «только QR». Правила в globals.css действуют только под этим
 * атрибутом на `<html>`, поэтому печать протокола их не видит.
 */
const PRINT_MODE_ATTR = 'data-print-mode';

interface LinksQrModalProps {
  onClose: () => void;
}

/**
 * Окно «Ссылки и QR-код»: ссылки анкеты пациента врача и клиники.
 *
 * Печать QR: лист с одним кодом рендерится порталом в `body`, на `<html>`
 * ставится `data-print-mode="qr"`, и правила печати оставляют на бумаге
 * только его. Режим снимается по `afterprint` и при закрытии окна — не
 * сразу после `window.print()`: там, где вызов не ждёт диалога, лист исчез
 * бы до печати.
 */
export const LinksQrModal = ({ onClose }: LinksQrModalProps) => {
  const { clinic, isLoading, error } = useMyClinic();
  const [printItem, setPrintItem] = useState<QuestionnaireLinkItem | null>(
    null,
  );
  const contentRef = useRef<HTMLDivElement>(null);

  // ModalShell фокус в окно не переносит: без этого клавиатура осталась бы
  // на странице под оверлеем.
  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const endPrint = () => {
      root.removeAttribute(PRINT_MODE_ATTR);
      setPrintItem(null);
    };

    window.addEventListener('afterprint', endPrint);
    return () => {
      window.removeEventListener('afterprint', endPrint);
      root.removeAttribute(PRINT_MODE_ATTR);
    };
  }, []);

  const handlePrint = (item: QuestionnaireLinkItem) => {
    // Лист должен оказаться в DOM до вызова print().
    flushSync(() => setPrintItem(item));
    document.documentElement.setAttribute(PRINT_MODE_ATTR, 'qr');
    window.print();
  };

  const content = () => {
    if (isLoading) {
      return (
        <div
          role="status"
          aria-label="Загрузка ссылок"
          className="mx-auto my-16 h-10 w-10 animate-spin rounded-full border-b-2 border-[#5D8CF1]"
        />
      );
    }

    if (error === 'no_clinic') {
      return (
        <p className="my-12 text-center text-[#8B8B8B]">
          Вы не состоите в клинике — ссылок для анкеты нет
        </p>
      );
    }

    if (error || !clinic) {
      return (
        <div className="my-12 flex flex-col items-center gap-3 text-center">
          <p className="text-[#D91528]">Не удалось загрузить ссылки</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer text-[#5D8CF1] hover:text-[#769CEF]"
          >
            Повторить
          </button>
        </div>
      );
    }

    return (
      <PatientLinkGenerator clinicId={clinic.clinic_id} onPrint={handlePrint} />
    );
  };

  return (
    <ModalShell title="Ссылки и QR-код" onClose={onClose}>
      {/* Своя прокрутка: ModalShell высоту не ограничивает, а две карточки
          на ноутбуке могут не поместиться. */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className="custom-scrollbar -mx-2 max-h-[70vh] overflow-y-auto px-2 outline-none"
      >
        {content()}
      </div>

      {printItem?.qrText ? <QrPrintSheet text={printItem.qrText} /> : null}
    </ModalShell>
  );
};
