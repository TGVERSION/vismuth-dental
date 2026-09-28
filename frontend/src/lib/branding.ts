// Брендинг клиники: цвет и логотип приходят с сервера, то есть это
// недоверенные данные, которые попадают в CSS и в атрибут src.
//
// Невалидированный цвет — это инъекция стилей: значение вида
// `#fff; background: url(...)` в объявлении переменной сделает ровно то, что
// в нём написано. Невалидированный URL логотипа со схемой `javascript:` —
// это XSS. Поэтому оба значения проходят строгую проверку **до** отрисовки,
// а при серверном рендере — ещё и до гидратации, когда клиентского кода на
// пути нет вовсе.

import type { CSSProperties } from 'react';
import type { QuestionnaireClinic } from '@/api';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Цвет клиники или null, если формат не ровно `#RRGGBB`. */
export const sanitizeBrandColor = (
  raw: string | null | undefined,
): string | null => {
  if (typeof raw !== 'string') return null;

  const value = raw.trim();
  return HEX_COLOR.test(value) ? value.toUpperCase() : null;
};

/**
 * URL картинки или null.
 *
 * Пропускаются относительные пути того же origin и абсолютные `https://`.
 * Внешние картинки рисуются через `<img referrerPolicy="no-referrer">`
 * (см. `SafeImage`): адрес анкеты содержит код пациента и не должен уходить
 * на чужой хост в заголовке Referer.
 *
 * Отклоняются `http:`, протокол-относительные `//host` и `/\host` (браузер
 * считает их адресом чужого хоста), логин и пароль в адресе, а также схемы
 * `javascript:` и `data:`.
 */
export const sanitizeImageUrl = (
  raw: string | null | undefined,
): string | null => {
  if (typeof raw !== 'string') return null;

  const value = raw.trim();
  if (value.startsWith('/')) {
    return value.startsWith('//') || value.startsWith('/\\') ? null : value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;

  return url.href;
};

/** Внешний ли адрес (после `sanitizeImageUrl`). */
export const isExternalImageUrl = (url: string): boolean =>
  url.startsWith('https://');

const channelToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Относительная яркость по WCAG. Цвет обязан быть уже проверенным. */
const relativeLuminance = (hex: string): number => {
  const r = channelToLinear(parseInt(hex.slice(1, 3), 16));
  const g = channelToLinear(parseInt(hex.slice(3, 5), 16));
  const b = channelToLinear(parseInt(hex.slice(5, 7), 16));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: number, b: number): number => {
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
};

export const DEFAULT_TEXT_COLOR = '#202020';

/**
 * Что писать поверх фирменного цвета.
 *
 * Клиника может задать светлый фирменный цвет, и белый текст на кнопке
 * станет нечитаемым. Выбираем тот из двух цветов, который даёт больший
 * контраст.
 */
export const pickContrastColor = (hex: string): string => {
  const safe = sanitizeBrandColor(hex);
  if (!safe) return '#FFFFFF';

  const brand = relativeLuminance(safe);
  const onWhite = contrastRatio(brand, relativeLuminance('#FFFFFF'));
  const onDark = contrastRatio(brand, relativeLuminance(DEFAULT_TEXT_COLOR));

  return onWhite >= onDark ? '#FFFFFF' : DEFAULT_TEXT_COLOR;
};

/** Нейтральная тема: применяется, когда брендинг не пришёл или не прошёл проверку. */
export const NEUTRAL_BRAND_COLOR = '#1B4B8F';

/**
 * CSS-переменные темы для контейнера анкеты.
 *
 * Возвращается объект стилей, а не строка: переменные ставятся атрибутом
 * `style`, и серверный текст ни на каком шаге не попадает в разметку как
 * разметка.
 */
export const brandStyle = (
  clinic: QuestionnaireClinic | null | undefined,
): CSSProperties => {
  const brand = sanitizeBrandColor(clinic?.brand_color) ?? NEUTRAL_BRAND_COLOR;

  return {
    '--q-brand': brand,
    '--q-brand-contrast': pickContrastColor(brand),
  } as CSSProperties;
};
