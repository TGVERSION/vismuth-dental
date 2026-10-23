'use client';

import type { DiffSegment } from '@/lib/text-diff';

interface HighlightedTextareaProps {
  id: string;
  value: string;
  /** Фрагменты `value`: изменённые подсвечиваются. */
  segments: DiffSegment[];
  onChange: (value: string) => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
}

// Оба слоя наследуют шрифт, размер и межстрочный интервал от обёртки и
// переносят текст одинаково: малейшее расхождение — и подсветка уезжает с
// букв.
const LAYER =
  'm-0 border-0 p-0 [font:inherit] [letter-spacing:inherit] whitespace-pre-wrap wrap-break-word';

/**
 * Поле ввода с подсветкой фрагментов. Обычная `textarea` лежит поверх слоя,
 * где видны только фоны подсветки, — поэтому курсор, выделение, ввод через
 * IME и отмена (Ctrl+Z) работают штатно, а текст не проходит через
 * contentEditable и innerHTML.
 */
export const HighlightedTextarea: React.FC<HighlightedTextareaProps> = ({
  id,
  value,
  segments,
  onChange,
  ariaLabel,
  ariaDescribedBy,
}) => (
  <div className="relative text-[16px] leading-[26px]">
    {/* Нижний слой задаёт высоту. Пробел нулевой ширины в конце нужен,
        чтобы пустая последняя строка после перевода строки тоже имела
        высоту. Горизонтальный отступ подсветки — тенью: padding сдвинул бы
        текст относительно textarea, а вертикальный padding строку не
        меняет. */}
    <div aria-hidden="true" className={`${LAYER} text-transparent`}>
      {segments.map((segment, index) =>
        segment.changed ? (
          <mark
            key={index}
            className="rounded-[4px] bg-[#DCE7FF] py-0.5 text-transparent shadow-[-5px_0_0_#DCE7FF,5px_0_0_#DCE7FF] [box-decoration-break:clone]"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
      {'​'}
    </div>
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      spellCheck={false}
      className={`${LAYER} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-[#202020] caret-[#5D8CF1] outline-none`}
    />
  </div>
);
