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
    className="shrink-0 text-[var(--ui-color-blue-600)]"
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
    <div data-print-hide className="flex flex-col gap-[var(--ui-space-14)]">
      <div className="flex flex-col gap-[var(--ui-space-10)]">
        <div id={noteId} className="flex flex-col gap-[var(--ui-space-2)]">
          <p className="flex items-center gap-[var(--ui-space-6)] text-[length:var(--ui-font-size-13)] text-[var(--ui-color-alabaster-950)]">
            <SparkleIcon />
            Не подтверждаются клин. реком. — отмечено:{' '}
            {finding.unnecessaryCount}
          </p>
          {guidelineTitle && (
            <p className="pl-5 text-[length:var(--ui-font-size-13)] text-[var(--ui-color-alabaster-950)]">
              По рекомендациям «{guidelineTitle}»
            </p>
          )}
        </div>
        <p
          aria-label={`Раздел «${label}» с отметками проверки`}
          aria-describedby={noteId}
          className="whitespace-pre-wrap wrap-break-word text-[length:var(--ui-font-size-16)] leading-[26px] text-[var(--ui-color-alabaster-dark-800)]"
        >
          {segments.map((segment, index) =>
            segment.unnecessary ? (
              <mark
                key={index}
                className="rounded-[var(--ui-radius-xs)] bg-[var(--ui-color-red-50)] px-[5px] py-[var(--ui-space-2)] text-[var(--ui-color-red-800)] [box-decoration-break:clone]"
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
          className="vismuth-button cursor-pointer bg-[var(--ui-color-blue-600)] text-white transition-colors hover:bg-[var(--ui-color-blue-700)]"
          data-variant="primary"
          data-size="s"
        >
          Убрать отмеченное
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="vismuth-button cursor-pointer bg-[var(--ui-color-blue-100)] transition-colors hover:bg-[var(--ui-color-blue-50)]"
          data-variant="secondary"
          data-size="s"
        >
          Оставить как было
        </button>
        {fragments.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFragments((prev) => !prev)}
            aria-expanded={showFragments}
            aria-controls={fragmentsId}
            className="vismuth-function-button h-9.5 cursor-pointer px-[var(--ui-space-2)] text-[length:var(--ui-font-size-14)] text-[var(--ui-color-blue-600)] transition-colors hover:text-[var(--ui-color-blue-700)]"
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
          className="flex flex-col gap-3 border-t border-[var(--ui-color-slate-200)] pt-4"
        >
          {fragments.map((fragment, index) => (
            <li key={index} className="flex flex-col gap-1">
              {fragment.section && (
                <p className="text-[length:var(--ui-font-size-13)] text-[var(--ui-color-alabaster-950)]">
                  {fragment.section}
                </p>
              )}
              <p className="whitespace-pre-wrap wrap-break-word text-[length:var(--ui-font-size-14)] leading-[22px] text-[var(--ui-color-alabaster-dark-800)]">
                {fragment.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
