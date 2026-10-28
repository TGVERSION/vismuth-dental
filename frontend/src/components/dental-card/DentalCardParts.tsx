'use client';

import type { DentalClarification, DentalHealthRow, DentalHistory as DentalHistoryData } from '@/api';

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

/**
 * Зубы и дёсны — стоматологический анамнез бумажной анкеты: последний визит,
 * признаки «есть / нет», осложнения прошлого лечения.
 */
export const DentalHistory = ({ history }: { history: DentalHistoryData }) => {
  const signs = history.signs.filter((sign) => sign.has);
  const noSigns = history.signs.filter((sign) => !sign.has);
  return (
    <>
      <p>
        <span className="font-medium">Последний визит к стоматологу:</span>{' '}
        {history.last_visit ? lowerFirst(history.last_visit) : 'не указан'}
      </p>
      {signs.length > 0 ? (
        <p>
          <span className="font-medium">Бывает:</span>{' '}
          {signs.map((sign) => lowerFirst(sign.label)).join(', ')}
        </p>
      ) : null}
      <p>
        <span className="font-medium">Осложнения при прошлом лечении:</span>{' '}
        {history.complications || 'не было'}
      </p>
      {noSigns.length > 0 ? (
        <p className="text-sm text-[#6C757D]">
          Нет: {noSigns.map((sign) => lowerFirst(sign.label)).join(', ')}
        </p>
      ) : null}
    </>
  );
};

/** Вопросы нейросети и ответы пациента дословно; пропущенный — серым. */
export const DentalClarifications = ({ items }: { items: DentalClarification[] }) => (
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
