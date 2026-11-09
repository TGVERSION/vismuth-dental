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
import type { ClinicBranding } from './questionnaire';

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

// Контраст считается по APCA 0.0.98G-4g (https://github.com/Myndex/apca-w3) —
// модели из черновика WCAG 3. Формула WCAG 2 не различает тёмное на светлом
// и светлое на тёмном и на средних синих, бирюзовых и оранжевых цветах
// выбирает тёмный текст, хотя белый читается заметно лучше.

/** Яркость цвета на экране по APCA. Цвет обязан быть уже проверенным. */
const screenLuminance = (hex: string): number => {
  const channel = (offset: number) =>
    (parseInt(hex.slice(offset, offset + 2), 16) / 255) ** 2.4;

  return (
    0.2126729 * channel(1) + 0.7151522 * channel(3) + 0.072175 * channel(5)
  );
};

const BLACK_THRESHOLD = 0.022;

/** Почти чёрные цвета подтягиваются вверх: экран не бывает идеально чёрным. */
const clampBlack = (y: number): number =>
  y > BLACK_THRESHOLD ? y : y + (BLACK_THRESHOLD - y) ** 1.414;

/** Модуль контраста Lc текста на фоне: 0 — неразличимо, ~106 — максимум. */
const apcaContrast = (text: string, background: string): number => {
  const txt = clampBlack(screenLuminance(text));
  const bg = clampBlack(screenLuminance(background));
  if (Math.abs(bg - txt) < 0.0005) return 0;

  // Тёмный текст на светлом фоне и светлый на тёмном — разные степени.
  const sapc =
    bg > txt
      ? (bg ** 0.56 - txt ** 0.57) * 1.14
      : (txt ** 0.62 - bg ** 0.65) * 1.14;

  return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
};

export const DEFAULT_TEXT_COLOR = '#202020';

/**
 * Что писать поверх фирменного цвета.
 *
 * Клиника может задать светлый фирменный цвет, и белый текст на кнопке
 * станет нечитаемым. Выбираем тот из двух цветов, который даёт больший
 * контраст по APCA.
 */
export const pickContrastColor = (hex: string): string => {
  const safe = sanitizeBrandColor(hex);
  if (!safe) return '#FFFFFF';

  const onWhite = apcaContrast('#FFFFFF', safe);
  const onDark = apcaContrast(DEFAULT_TEXT_COLOR, safe);

  return onWhite >= onDark ? '#FFFFFF' : DEFAULT_TEXT_COLOR;
};

/** Нейтральная тема: применяется, когда брендинг не пришёл или не прошёл проверку. */
export const NEUTRAL_BRAND_COLOR = '#1B4B8F';

/** Default button fill, independent of the logo background. */
export const DEFAULT_BUTTON_COLOR = '#202020';

/** Затемнение проверенного цвета кнопки: фон логотипа здесь не участвует. */
export const darkenButtonColor = (hex: string, amount = 0.1): string => {
  const safe = sanitizeBrandColor(hex) ?? DEFAULT_BUTTON_COLOR;
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return `#${[1, 3, 5]
    .map((offset) =>
      Math.round(parseInt(safe.slice(offset, offset + 2), 16) * factor)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
};

/**
 * CSS-переменные темы для контейнера анкеты.
 *
 * Возвращается объект стилей, а не строка: переменные ставятся атрибутом
 * `style`, и серверный текст ни на каком шаге не попадает в разметку как
 * разметка.
 */
export const brandStyle = (
  clinic: ClinicBranding | null | undefined,
): CSSProperties => {
  const brand =
    sanitizeBrandColor(clinic?.button_color) ?? DEFAULT_BUTTON_COLOR;
  const logoBackground = sanitizeBrandColor(clinic?.brand_color) ?? '#FFFFFF';
  const hover = darkenButtonColor(brand);
  const active = darkenButtonColor(brand, 0.18);

  return {
    '--q-brand': brand,
    '--q-brand-hover': hover,
    '--q-brand-hover-contrast': pickContrastColor(hover),
    '--q-brand-active': active,
    '--q-brand-active-contrast': pickContrastColor(active),
    '--q-logo-bg': logoBackground,
    '--q-logo-contrast': pickContrastColor(logoBackground),
    '--q-brand-contrast': pickContrastColor(brand),
    '--q-accent':
      apcaContrast(brand, '#FFFFFF') >= 60 ? brand : NEUTRAL_BRAND_COLOR,
  } as CSSProperties;
};
