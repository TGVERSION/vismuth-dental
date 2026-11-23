'use client';

import { useEffect, useRef, useState } from 'react';
import { NewLinkModal } from '@/components/registry/NewLinkModal';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { useMyClinic } from '@/hooks/useMyClinic';
import { useQuestionnaireQrPrint } from '@/hooks/useQuestionnaireQrPrint';
import { PatientLinkGenerator } from './PatientLinkGenerator';
import { QrPrintSheet } from './QrPrintSheet';

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
  const { print, printText } = useQuestionnaireQrPrint();
  const contentRef = useRef<HTMLDivElement>(null);
  const [dental, setDental] = useState(false);

  // ModalShell фокус в окно не переносит: без этого клавиатура осталась бы
  // на странице под оверлеем.
  useEffect(() => {
    contentRef.current?.focus();
  }, []);

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
      <PatientLinkGenerator
        clinicId={clinic.clinic_id}
        onPrint={print}
        compact
      />
    );
  };

  if (clinic && (clinic.questionnaire_kind === 'dental' || dental)) {
    return <NewLinkModal clinicId={clinic.clinic_id} onClose={onClose} />;
  }

  return (
    <ModalShell
      title="Создание ссылки пациенту"
      layout="wide-top"
      onClose={onClose}
    >
      {/* Своя прокрутка: ModalShell высоту не ограничивает, а две карточки
          на ноутбуке могут не поместиться. */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className="custom-scrollbar -mx-2 max-h-[70vh] overflow-y-auto px-2 outline-none"
      >
        {clinic?.questionnaire_kind === 'mixed' && (
          <button
            type="button"
            className="vismuth-function-button mb-4"
            onClick={() => setDental(true)}
          >
            Ссылка на стоматологическую анкету
          </button>
        )}
        {content()}
      </div>

      {printText ? <QrPrintSheet text={printText} /> : null}
    </ModalShell>
  );
};
