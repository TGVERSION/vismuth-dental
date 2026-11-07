'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useQuestionnaireTheme } from './QuestionnaireTheme';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Кнопки внизу шторки: «Готово», «Сбросить». */
  footer?: React.ReactNode;
}

/**
 * Шторка снизу — привычный для телефона способ выбора вместо выпадающего
 * списка: варианты не пытаются уместиться рядом с полем, а занимают нижнюю
 * часть экрана и не перекрываются клавиатурой.
 *
 * Компонент рендерится только когда шторка открыта: родитель монтирует его
 * по условию. Поэтому внутреннего состояния «открыта или нет» здесь нет, а
 * дочерние шторки получают чистое состояние при каждом открытии — без
 * синхронизации через эффекты.
 *
 * Содержимое уходит порталом в `document.body`, из-под контейнера анкеты,
 * поэтому тема ставится на обёртку заново: `data-questionnaire` даёт
 * нейтральные токены, а цвета клиники приходят из `useQuestionnaireTheme`.
 */
export const BottomSheet = ({
  title,
  onClose,
  children,
  footer,
}: BottomSheetProps) => {
  const theme = useQuestionnaireTheme();

  // Закрытие по Escape и блокировка прокрутки страницы под шторкой.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Шторка открывается только по нажатию, то есть всегда после гидратации.
  // Проверка нужна на случай рендера на сервере, где портала некуда класть.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-questionnaire
      className="fixed inset-0 z-[var(--ui-z-modal)] flex flex-col justify-end"
      style={theme}
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up relative flex max-h-[85dvh] flex-col rounded-t-[var(--ui-radius-2xl)] bg-[var(--q-bg)] shadow-[var(--ui-shadow)]"
      >
        <div className="flex shrink-0 items-center justify-between px-4 pt-5 pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="q-icon-button -mr-2 flex items-center justify-center"
          >
            <Image src="/close.svg" alt="" width={16} height={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>

        {footer ? (
          <div className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {footer}
          </div>
        ) : (
          <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </div>,
    document.body,
  );
};
