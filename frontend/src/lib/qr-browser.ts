// Браузерные действия с QR-кодом: PNG, скачивание, буфер обмена.
//
// Только для обработчиков клиентских компонентов: здесь `document`, canvas
// и `navigator.clipboard`. Сама матрица строится в чистом `qr.ts`.

import { QR_QUIET_ZONE, type QrMatrix } from './qr';

interface PngOptions {
  /** Сторона модуля в пикселях: 12 — около 4 см при 300 dpi для типичной ссылки. */
  moduleSize?: number;
  margin?: number;
}

/** PNG из матрицы: белый фон с полями, чёрные модули. */
export const qrPngBlob = (
  matrix: QrMatrix,
  { moduleSize = 12, margin = QR_QUIET_ZONE }: PngOptions = {},
): Promise<Blob> => {
  const side = (matrix.length + margin * 2) * moduleSize;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;

  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Canvas 2D недоступен'));

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, side, side);
  context.fillStyle = '#000000';
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect(
          (x + margin) * moduleSize,
          (y + margin) * moduleSize,
          moduleSize,
          moduleSize,
        );
      }
    });
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Не удалось построить PNG'));
    }, 'image/png');
  });
};

/**
 * Скачать файл по уже созданному `objectURL`.
 *
 * Адрес создаёт и отзывает вызывающий компонент: отзыв сразу после `click()`
 * в Firefox может оборвать скачивание, а отложенный отзыв таймером здесь
 * жил бы вне жизненного цикла компонента.
 */
export const triggerDownload = (objectUrl: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

type ClipboardItemWithSupports = typeof ClipboardItem & {
  supports?: (type: string) => boolean;
};

/**
 * Умеет ли браузер положить картинку в буфер. Вне HTTPS (кроме localhost)
 * буфера нет вовсе; `ClipboardItem.supports` есть не везде — где его нет,
 * пробуем записать.
 */
export const canCopyImage = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.clipboard?.write !== 'function') return false;
  if (typeof ClipboardItem === 'undefined') return false;

  const { supports } = ClipboardItem as ClipboardItemWithSupports;
  return typeof supports === 'function'
    ? supports.call(ClipboardItem, 'image/png')
    : true;
};

/**
 * Картинка в буфер обмена. Принимает промис PNG, а не готовый файл: Safari
 * пишет в буфер, только если `clipboard.write` вызван синхронно в обработчике
 * клика, а `await` построения PNG перед ним теряет жест пользователя.
 * `async`-функция выполняет `write` синхронно — до первого `await`.
 */
export const copyImage = async (png: Promise<Blob>): Promise<void> => {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
};

/** Текст в буфер обмена. Нет буфера или отказ — отклонённый промис. */
export const copyText = async (text: string): Promise<void> => {
  await navigator.clipboard.writeText(text);
};
