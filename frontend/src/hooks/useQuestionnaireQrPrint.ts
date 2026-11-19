'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { QuestionnaireLinkItem } from '@/lib/questionnaire-links';

const PRINT_MODE_ATTR = 'data-print-mode';

export function useQuestionnaireQrPrint() {
  const [printText, setPrintText] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const endPrint = () => {
      root.removeAttribute(PRINT_MODE_ATTR);
      setPrintText(null);
    };
    window.addEventListener('afterprint', endPrint);
    return () => {
      window.removeEventListener('afterprint', endPrint);
      root.removeAttribute(PRINT_MODE_ATTR);
    };
  }, []);

  const print = ({ qrText }: QuestionnaireLinkItem) => {
    if (!qrText) return;
    flushSync(() => setPrintText(qrText));
    document.documentElement.setAttribute(PRINT_MODE_ATTR, 'qr');
    window.print();
  };

  return { print, printText };
}
