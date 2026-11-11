'use client';

import { useId } from 'react';
import type { DentalClarification, DentalHealthRow } from '@/api';
import { partitionDentalHealth } from '@/lib/dental-health';

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
        className="pl-6 text-[length:var(--ui-font-size-31)] font-medium text-[var(--ui-color-alabaster-dark-800)]"
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2 pl-8 text-base text-[var(--ui-color-alabaster-dark-800)]">
        {children}
      </div>
    </section>
  );
};

/** Только первая буква: «Гепатит, ВИЧ…» → «гепатит, ВИЧ…», аббревиатуры целы. */
const lowerFirst = (text: string): string =>
  text.charAt(0).toLowerCase() + text.slice(1);

const noteClass =
  'rounded-2xl px-3 py-[var(--ui-space-10)] text-[length:var(--ui-font-size-14)]';

/** «Самое важное»: отмеченные риски. */
export const DentalImportant = ({ important }: { important: string[] }) =>
  important.length > 0 ? (
    <DentalBlock title="Самое важное">
      <ul className="flex flex-col gap-[var(--ui-space-6)]">
        {important.map((line) => (
          <li
            key={line}
            className={`${noteClass} bg-[var(--ui-color-red-50)] text-[var(--ui-color-red-600)]`}
          >
            {line}
          </li>
        ))}
      </ul>
    </DentalBlock>
  ) : null;

export const DentalQuestions = ({ questions }: { questions: string[] }) =>
  questions.length ? (
    <DentalBlock title="Что доспросить">
      <ul className="flex flex-col gap-[var(--ui-space-6)]">
        {questions.map((question) => (
          <li
            key={question}
            className={`${noteClass} bg-[var(--ui-color-alabaster-500)] text-[var(--ui-color-slate-600)]`}
          >
            {question}
          </li>
        ))}
      </ul>
    </DentalBlock>
  ) : null;

/** Здоровье: сообщённые состояния и ответы, требующие уточнения. */
export const DentalHealth = ({ health }: { health: DentalHealthRow[] }) => {
  const { positive: has, uncertain: unknown } = partitionDentalHealth(health);
  const uncertain = unknown.filter((row) => row.detail !== 'Не отвечено');
  if (!has.length && !uncertain.length) return null;
  return (
    <DentalBlock title="Здоровье">
      {has.map((row) => (
        <p key={row.key}>
          <span className="font-medium">{row.label}</span>
          {row.detail ? `: ${row.detail}` : ''}
        </p>
      ))}
      {uncertain.length > 0 ? (
        <p className="rounded-lg bg-[var(--ui-color-yellow-50)] px-3 py-2 text-sm text-[var(--ui-color-yellow-900)]">
          Нужно уточнить:{' '}
          {uncertain.map((row) => lowerFirst(row.label)).join(', ')}. Пациент не
          уверен в ответе.
        </p>
      ) : null}
    </DentalBlock>
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
        <dt className="text-sm text-[var(--ui-color-alabaster-950)]">
          {item.question}
        </dt>
        <dd
          className={
            item.answer ? '' : 'text-sm text-[var(--ui-color-alabaster-950)]'
          }
        >
          {item.answer || 'Пациент пропустил вопрос'}
        </dd>
      </div>
    ))}
  </dl>
);
