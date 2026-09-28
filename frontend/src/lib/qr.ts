// QR-код ссылки анкеты пациента: адрес → матрица модулей → SVG-путь.
//
// Библиотека `qrcode-generator` умеет и готовую разметку (`createSvgTag`,
// `createImgTag`), но это строки — их пришлось бы вставлять через innerHTML.
// Поэтому берётся только матрица (`isDark`), а картинку строит React (SVG на
// экране) и canvas (PNG для скачивания и буфера обмена, `qr-browser.ts`).
//
// Модуль чистый — без браузерных API, проверяется тестами в node.

import qrcode from 'qrcode-generator';

/** Поля вокруг кода в модулях: минимум по стандарту QR. */
export const QR_QUIET_ZONE = 4;

export type QrMatrix = boolean[][];

/**
 * Адрес для кодирования или `null`.
 *
 * Библиотека по умолчанию кодирует символы как Latin-1 (`charCode & 0xff`):
 * кириллический домен или путь исказились бы. `URL.href` приводит адрес
 * к ASCII — домен в punycode, путь в percent-encoding. Заодно отсекается всё,
 * что не http(s): в QR для пациента другой схемы быть не должно.
 */
export const normalizeQrUrl = (url: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  return parsed.href;
};

/**
 * Матрица QR: `true` — тёмный модуль. Размер подбирается автоматически,
 * уровень коррекции M — обычный баланс плотности и устойчивости печатного
 * кода к загрязнению и бликам.
 */
export const buildQrMatrix = (text: string): QrMatrix => {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();

  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
};

/** Сторона `viewBox` в модулях вместе с полями. */
export const qrViewBoxSize = (
  matrix: QrMatrix,
  margin: number = QR_QUIET_ZONE,
): number => matrix.length + margin * 2;

/**
 * SVG-путь из квадратов тёмных модулей, смещённых на поля. Один `<path>`
 * вместо сотен `<rect>` — меньше элементов в DOM.
 */
export const qrPathData = (
  matrix: QrMatrix,
  margin: number = QR_QUIET_ZONE,
): string => {
  const parts: string[] = [];

  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + margin} ${y + margin}h1v1h-1z`);
    });
  });

  return parts.join('');
};
