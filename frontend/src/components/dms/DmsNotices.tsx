'use client';

import type { DmsNoGuidelineText } from '@/lib/dms-justification';

// Сообщения помощника «Обоснование для ДМС» у полей протокола: ожидание,
// ошибка у разделов помощника и «нет клинических рекомендаций» у диагноза.

/**
 * Ожидание ответа. Стоит внутри заблокированного (`inert`) протокола, а
 * такое содержимое скрыто от экранного диктора, — поэтому ход работы
 * объявляет отдельная область статуса вне блокировки, а не этот блок.
 */
export const DmsLoadingNotice: React.FC<{ stepText: string }> = ({
  stepText,
}) => (
  <div data-print-hide className="flex items-start gap-2.5">
    <span
      aria-hidden="true"
      className="mt-0.5 h-4.5 w-4.5 shrink-0 animate-spin rounded-full border-b-2 border-[#5D8CF1]"
    />
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-[16px] text-[#202020]">{stepText}…</p>
      <p className="text-[13px] text-[#909090]">
        Обычно до минуты. Пока идёт обоснование, протокол нельзя изменить.
      </p>
    </div>
  </div>
);

interface DmsFieldErrorProps {
  message: string;
  /** Без обработчика кнопки нет: повтор не поможет. */
  onRetry?: () => void;
  /**
   * Объявить ошибку экранному диктору. Сообщение повторяется у каждого
   * раздела помощника, а объявить его нужно один раз.
   */
  announce: boolean;
}

export const DmsFieldError: React.FC<DmsFieldErrorProps> = ({
  message,
  onRetry,
  announce,
}) => (
  <div
    data-print-hide
    role={announce ? 'alert' : undefined}
    className="flex flex-wrap items-center gap-x-4 gap-y-2"
  >
    <p className="text-[14px] text-[#D91528]">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="h-9.5 cursor-pointer rounded-[10px] bg-[#DCE7FF] px-5.5 text-[14px] text-[#202020] transition-colors hover:bg-[#F0F5FF]"
      >
        Повторить
      </button>
    )}
  </div>
);

interface DmsNoGuidelineNoticeProps {
  text: DmsNoGuidelineText;
  onDismiss: () => void;
}

/**
 * «Для диагноза нет клинических рекомендаций» — у поля диагноза: причина в
 * нём, там же врач её исправит. Повтора нет: с тем же диагнозом ответ будет
 * тем же.
 */
export const DmsNoGuidelineNotice: React.FC<DmsNoGuidelineNoticeProps> = ({
  text,
  onDismiss,
}) => (
  <div
    data-print-hide
    role="status"
    className="flex max-w-[72ch] items-start gap-2.5 rounded-xl bg-[#FFF5E3] px-3.5 py-3 text-[14px] text-[#7F4B00]"
  >
    <span
      aria-hidden="true"
      className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#F29100]"
    />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p>
        <b className="font-semibold">{text.title}</b> {text.details}
      </p>
      <p>{text.hint}</p>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      className="cursor-pointer underline underline-offset-3 hover:no-underline"
    >
      Понятно
    </button>
  </div>
);
