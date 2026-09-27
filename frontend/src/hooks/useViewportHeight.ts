'use client';

import { useSyncExternalStore } from 'react';

/**
 * Высота видимой области экрана с учётом экранной клавиатуры.
 *
 * Зачем: единицы `dvh` учитывают панели браузера, но на клавиатуру не
 * реагируют. Safari на iOS при её появлении не меняет размер страницы —
 * он уменьшает только «визуальный» вьюпорт. Экран чата, растянутый на
 * `100dvh`, остаётся прежней высоты, и поле ввода оказывается под
 * клавиатурой: пациент не видит, что печатает.
 *
 * Chrome на Android эту задачу решает сам, если в мета-теге задано
 * `interactive-widget=resizes-content` (см. layout анкеты). Для Safari
 * остаётся Visual Viewport API.
 *
 * Подписка сделана через `useSyncExternalStore`, а не через эффект с
 * `setState`: это штатный способ читать внешний источник, он безопасен при
 * серверном рендере и не вызывает лишнего каскада перерисовок.
 *
 * Возвращает `null`, когда API недоступно — тогда вызывающий код остаётся
 * на `100dvh`, то есть поведение не хуже прежнего.
 */

const subscribe = (onChange: () => void): (() => void) => {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  // scroll важен наравне с resize: на iOS при открытии клавиатуры вьюпорт
  // не только сжимается, но и сдвигается.
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);

  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
  };
};

const getSnapshot = (): number | null => window.visualViewport?.height ?? null;

/** На сервере размеров экрана нет. */
const getServerSnapshot = (): number | null => null;

export const useViewportHeight = (): number | null =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
