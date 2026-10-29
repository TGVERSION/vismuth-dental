'use client';

import { useState } from 'react';
import type { DmsFinding } from '@/lib/dms-check';

interface DmsReviewBlockProps {
  label: string;
  finding: DmsFinding;
  onRemove: () => void;
  onKeep: () => void;
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
 * Итог проверки раздела: текст как есть, назначения без обоснования в
 * клинических рекомендациях выделены. Пока врач не нажал «Убрать
 * отмеченное», раздел протокола не меняется. Фрагменты клинрека, на которые
 * опиралась проверка, — под кнопками, по умолчанию скрыты.
 */
export const DmsReviewBlock: React.FC<DmsReviewBlockProps> = ({
  label,
  finding,
  onRemove,
  onKeep,
}) => {
  const [showFragments, setShowFragments] = useState(false);

  const { sectionId, segments, fragments, guidelineTitle } = finding;
  const noteId = `dms-note-${sectionId}`;
  const fragmentsId = `dms-fragments-${sectionId}`;

  return (
    <div data-print-hide className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        <div id={noteId} className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 text-[13px] text-[#909090]">
            <SparkleIcon />
            Не подтверждаются клин. реком. — отмечено:{' '}
            {finding.unnecessaryCount}
          </p>
          {guidelineTitle && (
            <p className="pl-5 text-[13px] text-[#909090]">
              По рекомендациям «{guidelineTitle}»
            </p>
          )}
        </div>
        <p
          aria-label={`Раздел «${label}» с отметками проверки`}
          aria-describedby={noteId}
          className="whitespace-pre-wrap wrap-break-word text-[16px] leading-[26px] text-[#202020]"
        >
          {segments.map((segment, index) =>
            segment.unnecessary ? (
              <mark
                key={index}
                className="rounded-[4px] bg-[#FDEEEF] px-[5px] py-0.5 text-[#9E1420] [box-decoration-break:clone]"
              >
                <span className="sr-only">нет в клин. реком.: </span>
                {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRemove}
          className="h-9.5 cursor-pointer rounded-[10px] bg-[#5D8CF1] px-5.5 text-[14px] text-white transition-colors hover:bg-[#769CEF]"
        >
          Убрать отмеченное
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="h-9.5 cursor-pointer rounded-[10px] bg-[#DCE7FF] px-5.5 text-[14px] text-[#202020] transition-colors hover:bg-[#F0F5FF]"
        >
          Оставить как было
        </button>
        {fragments.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFragments((prev) => !prev)}
            aria-expanded={showFragments}
            aria-controls={fragmentsId}
            className="h-9.5 cursor-pointer px-0.5 text-[14px] text-[#5D8CF1] transition-colors hover:text-[#769CEF]"
          >
            {showFragments
              ? 'Скрыть фрагменты клин. реком.'
              : 'Показать фрагменты клин. реком.'}
          </button>
        )}
      </div>

      {fragments.length > 0 && (
        <ul
          id={fragmentsId}
          hidden={!showFragments}
          className="flex flex-col gap-3 border-t border-[#E9ECEF] pt-4"
        >
          {fragments.map((fragment, index) => (
            <li key={index} className="flex flex-col gap-1">
              {fragment.section && (
                <p className="text-[13px] text-[#909090]">{fragment.section}</p>
              )}
              <p className="whitespace-pre-wrap wrap-break-word text-[14px] leading-[22px] text-[#202020]">
                {fragment.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
