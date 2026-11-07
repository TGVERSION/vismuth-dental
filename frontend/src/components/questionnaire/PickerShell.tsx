'use client';

import { useEffect, useRef } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { BottomSheet } from './BottomSheet';

interface PickerShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Кнопки внизу: «Готово», «Сбросить». */
  footer?: React.ReactNode;
  /**
   * Как считать высоту панели на десктопе.
   *
   * `list` — ограниченная высота с прокруткой: подходит спискам, которые
   * могут быть сколь угодно длинными.
   * `fit` — по содержимому: нужен календарю и колёсам времени, у них своя
   * фиксированная сетка, и внешняя прокрутка резала бы её пополам.
   */
  size?: 'list' | 'fit';
}

/**
 * Оболочка выбора значения: одно содержимое, два способа показа.
 *
 * На телефоне — шторка снизу: список не жмётся рядом с полем и не
 * перекрывается клавиатурой. На десктопе — обычный выпадающий список под
 * полем: шторка, выезжающая снизу экрана в 1080p, выглядит чужеродно.
 *
 * Выпадающий список позиционируется относительно родителя, поэтому
 * вызывающий код обязан обернуть поле и `PickerShell` в контейнер с
 * `relative`. Это проще и надёжнее портала с измерением координат: колонка
 * анкеты узкая и никуда не уезжает.
 */
export const PickerShell = ({
  title,
  onClose,
  children,
  footer,
  size = 'list',
}: PickerShellProps) => {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие по Escape и по нажатию вне списка — только для десктопного
  // варианта: у шторки это уже есть, там свой фон и крестик.
  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      // Нажатие по самому полю обрабатывает кнопка-триггер: закрывать
      // здесь же — значит открыть и сразу закрыть список.
      if (panel.parentElement?.contains(event.target as Node)) return;

      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isDesktop, onClose]);

  if (!isDesktop) {
    return (
      <BottomSheet title={title} onClose={onClose} footer={footer}>
        {children}
      </BottomSheet>
    );
  }

  // Вид повторяет CustomDropdown с экрана протокола: белая панель со светлой
  // рамкой, скруглением и тенью. Так выпадающие списки в анкете и в
  // Ассистенте выглядят одинаково, хотя компоненты разные.
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className={`animate-fade-in absolute top-full right-0 left-0 z-50 mt-2 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ${
        size === 'list' ? 'max-h-60' : ''
      }`}
    >
      <div className={size === 'list' ? 'min-h-0 flex-1 overflow-y-auto' : ''}>
        {children}
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-gray-100 p-2">{footer}</div>
      ) : null}
    </div>
  );
};
