'use client';

import { useId } from 'react';
import type { DentalClarification, DentalHealthRow } from '@/api';

// Части карточки стоматологической анкеты, общие для врача и регистратуры.

/** Раздел карточки — как раздел анкеты у врача (`QuestionnaireSection`). */
export const DentalBlock = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2
        id={headingId}
        className="pl-6 text-[32px] font-medium text-[#202020]"
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2 pl-8 text-base text-[#202020]">
        {children}
      </div>
    </section>
  );
};

/** Только первая буква: «Гепатит, ВИЧ…» → «гепатит, ВИЧ…», аббревиатуры целы. */
const lowerFirst = (text: string): string =>
  text.charAt(0).toLowerCase() + text.slice(1);

/** «Самое важное»: красные строки или зелёная «ничего опасного». */
export const DentalImportant = ({ important }: { important: string[] }) =>
  important.length > 0 ? (
    <ul className="flex flex-col gap-1.5">
      {important.map((line) => (
        <li
          key={line}
          className="rounded-[15px] bg-[#FDECEC] px-3 py-2.5 text-[14px] text-[#D91528]"
        >
          {line}
        </li>
      ))}
    </ul>
  ) : (
    <p className="w-fit rounded-[15px] bg-[#F3F4F8] px-3 py-2.5 text-[14px] text-[#6C757D]">
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

/** Вопросы нейросети и ответы пациента дословно; пропущенный — серым. */
export const DentalClarifications = ({
  items,
}: {
  items: DentalClarification[];
}) => (
  <dl className="flex flex-col gap-2">
    {items.map((item) => (
      <div key={item.question}>
        <dt className="text-sm text-[#6C757D]">{item.question}</dt>
        <dd className={item.answer ? '' : 'text-sm text-[#8B8B8B]'}>
          {item.answer || 'Пациент пропустил вопрос'}
        </dd>
      </div>
    ))}
  </dl>
);
