'use client';

import type { DentalHealthRow } from '@/api';

// Части карточки стоматологической анкеты, общие для врача и регистратуры.

/** Только первая буква: «Гепатит, ВИЧ…» → «гепатит, ВИЧ…», аббревиатуры целы. */
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** «Самое важное»: красные строки или зелёная «ничего опасного». */
export const DentalImportant = ({ important }: { important: string[] }) =>
  important.length > 0 ? (
    <ul className="flex flex-col gap-1.5">
      {important.map((line) => (
        <li key={line} className="rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#8E1F1F]">
          {line}
        </li>
      ))}
    </ul>
  ) : (
    <p className="rounded-lg bg-[#E6F4EC] px-3 py-2 text-sm text-[#14603B]">
      Ничего опасного для лечения не отмечено
    </p>
  );

/** Здоровье: что есть — с уточнением, остального нет — одной строкой. */
export const DentalHealth = ({ health }: { health: DentalHealthRow[] }) => {
  const has = health.filter((row) => row.has);
  const hasNot = health.filter((row) => !row.has);
  return (
    <>
      {has.map((row) => (
        <p key={row.key}>
          <span className="font-medium">{row.label}</span>
          {row.detail ? `: ${row.detail}` : ''}
        </p>
      ))}
      {hasNot.length > 0 ? (
        <p className="text-sm text-[#6C757D]">
          Нет: {hasNot.map((row) => lowerFirst(row.label)).join(', ')}
        </p>
      ) : null}
    </>
  );
};
