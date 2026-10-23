'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { diffText } from '@/lib/text-diff';
import { HighlightedTextarea } from './HighlightedTextarea';

interface DmsReviewBlockProps {
  sectionId: number;
  label: string;
  /** Текст раздела в момент запуска. */
  original: string;
  /** Новый текст, который врач видит и правит. */
  draft: string;
  onDraftChange: (draft: string) => void;
  onAccept: () => void;
  onKeep: () => void;
  /**
   * Колонка протокола. При раскрытии «Было» она прокручивается на его
   * высоту, чтобы кнопки остались на том же месте экрана.
   */
  scrollContainer: HTMLElement | null;
}

const SparkleIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="shrink-0 text-[#5D8CF1]"
  >
    <path
      d="M10 3c.7 4.4 2.6 6.3 7 7-4.4.7-6.3 2.6-7 7-.7-4.4-2.6-6.3-7-7 4.4-.7 6.3-2.6 7-7z"
      fill="currentColor"
    />
    <path
      d="M18.5 14c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Проверка раздела целиком: «Было» (по умолчанию скрыто) и новый текст, где
 * цветом выделено всё, чего нет в прежнем тексте, — и от помощника, и
 * вписанное врачом. Пока врач не нажал «Принять», раздел протокола не
 * меняется.
 */
export const DmsReviewBlock: React.FC<DmsReviewBlockProps> = ({
  sectionId,
  label,
  original,
  draft,
  onDraftChange,
  onAccept,
  onKeep,
  scrollContainer,
}) => {
  const [showBefore, setShowBefore] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  // Положение кнопок до раскрытия или скрытия «Было».
  const anchorTopRef = useRef<number | null>(null);

  const diff = useMemo(() => diffText(original, draft), [original, draft]);

  const beforeId = `dms-before-${sectionId}`;
  const noteId = `dms-note-${sectionId}`;
  const editorId = `dms-draft-${sectionId}`;

  const toggleBefore = () => {
    anchorTopRef.current =
      actionsRef.current?.getBoundingClientRect().top ?? null;
    setShowBefore((prev) => !prev);
  };

  // «Было» стоит над кнопками и сдвигает их. Колонка докручивается на ту же
  // величину до отрисовки кадра — кнопки остаются там, где был курсор.
  useLayoutEffect(() => {
    const previousTop = anchorTopRef.current;
    anchorTopRef.current = null;
    if (previousTop === null || !actionsRef.current || !scrollContainer) {
      return;
    }
    const delta = actionsRef.current.getBoundingClientRect().top - previousTop;
    if (delta !== 0) scrollContainer.scrollBy({ top: delta });
  }, [showBefore, scrollContainer]);

  return (
    <div data-print-hide className="flex flex-col gap-3.5">
      <div
        id={beforeId}
        hidden={!showBefore}
        className="flex flex-col gap-2 border-b border-[#E9ECEF] pb-4"
      >
        <p className="text-[13px] text-[#909090]">Было</p>
        <p className="whitespace-pre-wrap wrap-break-word text-[16px] leading-[26px] text-[#202020]">
          {diff.before.map((segment, index) =>
            segment.changed ? (
              <del
                key={index}
                className="rounded-[4px] bg-[#FDEEEF] px-[5px] py-0.5 text-[#9E1420] [box-decoration-break:clone]"
              >
                <span className="sr-only">убрано: </span>
                {segment.text}
              </del>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <p
          id={noteId}
          className="flex items-center gap-1.5 text-[13px] text-[#909090]"
        >
          <SparkleIcon />
          Текст дополнен по клин. реком. Цветом выделено новое
        </p>
        <HighlightedTextarea
          id={editorId}
          value={draft}
          segments={diff.after}
          onChange={onDraftChange}
          ariaLabel={`Новый текст раздела «${label}»`}
          ariaDescribedBy={noteId}
        />
      </div>

      <div ref={actionsRef} className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onAccept}
          // Пустой текст стёр бы раздел одним нажатием.
          disabled={!draft.trim()}
          className="h-9.5 cursor-pointer rounded-[10px] bg-[#5D8CF1] px-5.5 text-[14px] text-white transition-colors hover:bg-[#769CEF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Принять
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="h-9.5 cursor-pointer rounded-[10px] bg-[#DCE7FF] px-5.5 text-[14px] text-[#202020] transition-colors hover:bg-[#F0F5FF]"
        >
          Оставить как было
        </button>
        <button
          type="button"
          onClick={toggleBefore}
          aria-expanded={showBefore}
          aria-controls={beforeId}
          className="h-9.5 cursor-pointer px-0.5 text-[14px] text-[#5D8CF1] transition-colors hover:text-[#769CEF]"
        >
          {showBefore ? 'Скрыть как было' : 'Показать как было'}
        </button>
      </div>
    </div>
  );
};
