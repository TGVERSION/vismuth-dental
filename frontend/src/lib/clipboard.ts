// Копирование текста в буфер обмена.
//
// Только для обработчиков клиентских компонентов: здесь `document` и
// `navigator.clipboard`.

/**
 * Старый способ: выделить текст в скрытом поле и выполнить `copy`.
 * `execCommand` устарел, но работает и вне HTTPS, где Clipboard API нет.
 * Срабатывает только синхронно в обработчике действия пользователя.
 */
const copyViaSelection = (text: string, document: Document): void => {
  const previousFocus = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  const field = document.createElement('textarea');
  field.value = text;
  // `readonly` не даёт открыться клавиатуре на телефоне, 16px — не даёт iOS
  // увеличить страницу при фокусе, `fixed` — прокрутить её к полю.
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '0';
  field.style.opacity = '0';
  field.style.fontSize = '16px';
  document.body.appendChild(field);

  let copied = false;
  try {
    field.focus();
    field.select();
    // iOS Safari не выделяет текст через `select()`.
    field.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } finally {
    field.remove();
    previousFocus?.focus?.({ preventScroll: true });
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }

  if (!copied) throw new Error('Браузер не выполнил копирование');
};

/**
 * Текст в буфер обмена. Clipboard API есть только по HTTPS и на localhost;
 * без него и при отказе в доступе — копирование через выделение. Не вышло
 * ни так, ни так — отклонённый промис.
 */
export const copyText = async (
  text: string,
  sourceWindow: Window = window,
): Promise<void> => {
  const { navigator, document } = sourceWindow;
  if (sourceWindow.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Нет разрешения на запись — пробуем выделение.
    }
  }

  copyViaSelection(text, document);
};
