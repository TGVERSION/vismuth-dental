'use client';

import Link from 'next/link';
import { useId } from 'react';
import { formatDateLabel } from '@/lib/calendar';
import { patientName } from '@/lib/doctor-questionnaires';
import { groupRegistryByCompletionDay } from '@/lib/registry';

type ListItem = Parameters<typeof patientName>[0] & {
  id: string;
  code?: string | null;
  completed_at?: string | null;
};

type CompletedQuestionnaireListProps<T extends ListItem> = {
  items: T[];
  selectedId: string | null;
  utcOffsetMinutes: number;
} & (
  | { hrefFor: (id: string) => string; onSelect?: never }
  | { hrefFor?: never; onSelect: (id: string) => void }
);

/**
 * Заполненные анкеты сгруппированы по дню. Выбор — в адресе `?id=`.
 */
export const CompletedQuestionnaireList = <T extends ListItem>({
  items,
  selectedId,
  hrefFor,
  onSelect,
  utcOffsetMinutes,
}: CompletedQuestionnaireListProps<T>) => {
  const headingPrefix = useId();
  return (
    <div className="flex flex-col gap-4 px-3">
      {groupRegistryByCompletionDay(items, utcOffsetMinutes).map(
        ([day, entries]) => (
          <section key={day} aria-labelledby={`${headingPrefix}-${day}`}>
            <h2
              id={`${headingPrefix}-${day}`}
              className="mb-2 py-2 text-sm font-medium"
            >
              {formatDateLabel(day)}
            </h2>
            <ul className="flex flex-col gap-1">
              {entries.map((item) => {
                const isSelected = item.id === selectedId;
                const name = patientName(item);
                const rowClass = `flex w-full items-center gap-3 rounded-2xl px-3 py-[var(--ui-space-10)] text-left text-sm text-[var(--ui-color-alabaster-dark-800)] transition-colors ${isSelected ? 'bg-white' : 'hover:bg-white'}`;
                const content = (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {item.code && (
                        <strong>
                          {item.code}
                          {name && ' · '}
                        </strong>
                      )}
                      {name || (!item.code && 'Пациент')}
                    </span>
                  </span>
                );
                return (
                  <li key={item.id}>
                    {hrefFor ? (
                      <Link
                        href={hrefFor(item.id)}
                        scroll={false}
                        aria-current={isSelected ? 'true' : undefined}
                        className={rowClass}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-pressed={isSelected}
                        className={`${rowClass} cursor-pointer`}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
    </div>
  );
};
