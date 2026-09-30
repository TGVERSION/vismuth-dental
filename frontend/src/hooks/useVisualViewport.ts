'use client';

import { useSyncExternalStore } from 'react';

/**
 * Видимая область экрана с учётом экранной клавиатуры: её высота и сдвиг
 * относительно layout viewport — области, от которой отсчитываются
 * `position: fixed` элементы.
 *
 * Сдвиг берётся именно `offsetTop`, а не `pageTop` (от начала документа):
 * экран чата закреплён, и его положение считается от layout viewport.
 * С `pageTop` экран уехал бы, как только документ окажется прокручен.
 *
 * Зачем: единицы `dvh` учитывают панели браузера, но на клавиатуру не
 * реагируют. Safari на iOS при её появлении не меняет размер страницы —
 * он уменьшает только «визуальный» вьюпорт и вдобавок сдвигает его вниз,
 * чтобы поле в фокусе оказалось над клавиатурой. Экран чата, растянутый на
 * `100dvh`, остаётся прежней высоты, и поле ввода оказывается под
 * клавиатурой. Подогнать одну высоту мало: экран станет короче, но
 * останется у верха страницы, а видимая область уже сдвинута — и поле
 * повиснет над клавиатурой с пустой полосой под ним. Поэтому экран
 * совмещается с видимой областью и по высоте, и по сдвигу.
 *
 * Chrome на Android эту задачу решает сам, если в мета-теге задано
 * `interactive-widget=resizes-content` (см. layout анкеты): страница
 * сжимается, сдвиг остаётся нулевым. Для Safari остаётся Visual Viewport API.
 *
 * При масштабировании жестом видимая область тоже уменьшается, но подгонять
 * под неё экран нельзя: он сжимался бы вместе с зумом и ездил за пальцем.
 * Поэтому при зуме возвращается `null`. Отсюда ограничение: поле ввода
 * со шрифтом меньше 16px iOS при фокусе масштабирует, и подстройка
 * выключилась бы ровно тогда, когда открыта клавиатура.
 *
 * Подписка сделана через `useSyncExternalStore`, а не через эффект с
 * `setState`: это штатный способ читать внешний источник, он безопасен при
 * серверном рендере и не вызывает лишнего каскада перерисовок.
 *
 * Возвращает `null`, когда API недоступно или страница масштабирована —
 * тогда вызывающий код остаётся на `100dvh`, то есть поведение не хуже
 * прежнего.
 */

export interface VisualViewportBox {
  /** Высота видимой области, px. */
  height: number;
  /** Сдвиг видимой области от верха layout viewport, px. */
  offsetTop: number;
}

/** Насколько масштаб может отличаться от 1, чтобы считаться «без зума». */
const ZOOM_TOLERANCE = 0.01;

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

// Снимок — объект, а useSyncExternalStore сравнивает снимки по ссылке:
// новый объект на каждый вызов означал бы бесконечные перерисовки. Поэтому
// последний снимок переиспользуется, пока числа не изменились.
let lastBox: VisualViewportBox | null = null;

const getSnapshot = (): VisualViewportBox | null => {
  const viewport = window.visualViewport;
  if (!viewport || Math.abs(viewport.scale - 1) > ZOOM_TOLERANCE) return null;

  const { height, offsetTop } = viewport;
  if (lastBox?.height !== height || lastBox.offsetTop !== offsetTop) {
    lastBox = { height, offsetTop };
  }

  return lastBox;
};

/** На сервере размеров экрана нет. */
const getServerSnapshot = (): VisualViewportBox | null => null;

export const useVisualViewport = (): VisualViewportBox | null =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
