// Подготовка текста протокола к вставке в contentEditable.
//
// Значение поля приходит с сервера, из шаблонов, от ИИ-помощников и из буфера
// обмена. Всё это — недоверенный текст, а вставляется он через innerHTML,
// потому что маркеры вида [что-то] подсвечиваются разметкой. Поэтому сначала
// экранируем, и только потом добавляем свою разметку.

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export const formatTextWithPlaceholders = (text: string): string =>
  escapeHtml(text).replace(
    /\[([^\]]+)\]/g,
    '<span class="placeholder-bracket" data-placeholder="$1">[$1]</span>',
  );
