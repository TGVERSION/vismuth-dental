'use client';

import { useSyncExternalStore } from 'react';

/**
 * Достаточно ли широк экран для десктопной раскладки анкеты.
 *
 * Порог совпадает с брейкпоинтом `md` из темы проекта. Он нужен именно в JS,
 * а не только в CSS: на телефоне выбор открывается шторкой снизу, на
 * десктопе — выпадающим списком у поля, и это разные узлы разметки с разным
 * поведением (портал и блокировка прокрутки против позиционирования рядом
 * с полем). Показывать оба и прятать один классами нельзя — скрытая шторка
 * всё равно заблокировала бы прокрутку страницы.
 *
 * Подписка через `useSyncExternalStore`: безопасно при серверном рендере и
 * без эффекта с `setState`.
 */

const DESKTOP_QUERY = '(min-width: 768px)';

const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
};

const getSnapshot = (): boolean => window.matchMedia(DESKTOP_QUERY).matches;

/**
 * На сервере ширины экрана нет. Отвечаем «не десктоп»: анкета мобильная по
 * замыслу, и это безопасное умолчание. Расхождения при гидратации нет —
 * выбор открывается только по нажатию, то есть уже после неё.
 */
const getServerSnapshot = (): boolean => false;

export const useIsDesktop = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
