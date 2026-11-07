'use client';

import type { DmsNoGuidelineText } from '@/lib/dms-check';

// Сообщения помощника «Проверка для ДМС» у полей протокола: ожидание,
// ошибка у разделов помощника и «нет клинических рекомендаций» у диагноза.

/**
 * Ожидание ответа. Стоит внутри заблокированного (`inert`) протокола, а
 * такое содержимое скрыто от экранного диктора, — поэтому ход работы
 * объявляет отдельная область статуса вне блокировки, а не этот блок.
 */
export const DmsLoadingNotice: React.FC<{ stepText: string }> = ({
  stepText,
}) => (
  <div data-print-hide className="flex items-start gap-[var(--ui-space-10)]">
    <span
      aria-hidden="true"
      className="mt-[var(--ui-space-2)] h-4.5 w-4.5 shrink-0 animate-spin rounded-full border-b-2 border-[var(--ui-color-blue-600)]"
    />
    <div className="flex min-w-0 flex-col gap-[var(--ui-space-2)]">
      <p className="text-[length:var(--ui-font-size-16)] text-[var(--ui-color-alabaster-dark-800)]">
        {stepText}…
      </p>
      <p className="text-[length:var(--ui-font-size-13)] text-[var(--ui-color-alabaster-950)]">
        Обычно до минуты, первый раз по диагнозу — дольше. Пока идёт проверка,
        протокол нельзя изменить.
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
    <p className="text-[length:var(--ui-font-size-14)] text-[var(--ui-color-red-600)]">
      {message}
    </p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="vismuth-button cursor-pointer bg-[var(--ui-color-blue-100)] transition-colors hover:bg-[var(--ui-color-blue-50)]"
        data-variant="secondary"
        data-size="s"
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
    className="flex max-w-[72ch] items-start gap-[var(--ui-space-10)] rounded-xl bg-[var(--ui-color-yellow-50)] px-[var(--ui-space-14)] py-3 text-[length:var(--ui-font-size-14)] text-[var(--ui-color-yellow-800)]"
  >
    <span
      aria-hidden="true"
      className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[var(--ui-color-yellow-600)]"
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
