'use client';

import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { buildQrMatrix } from '@/lib/qr';
import { QrCode } from './QrCode';

interface QrPrintSheetProps {
  /** Что закодировать — нормализованный адрес. */
  text: string;
}

/**
 * Лист печати QR: прямой потомок `body`, только QR — по ТЗ на печать больше
 * ничего не идёт. На экране скрыт; при печати с `data-print-mode="qr"` на
 * `<html>` остаётся единственным видимым элементом (globals.css).
 */
export const QrPrintSheet = ({ text }: QrPrintSheetProps) => {
  const matrix = useMemo(() => buildQrMatrix(text), [text]);

  return createPortal(
    <div data-print-qr-sheet aria-hidden="true">
      <QrCode matrix={matrix} label="QR-код" className="h-[90mm] w-[90mm]" />
    </div>,
    document.body,
  );
};
