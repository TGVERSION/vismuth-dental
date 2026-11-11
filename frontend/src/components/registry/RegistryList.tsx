'use client';

import Link from 'next/link';
import type { RegistryQuestionnaireItem } from '@/api';
import { formatDateLabel } from '@/lib/calendar';
import { groupRegistryByCompletionDay, patientFullName } from '@/lib/registry';

interface RegistryListProps {
  items: RegistryQuestionnaireItem[];
  selectedId: string | null;
  clinicId?: string | null;
  utcOffsetMinutes: number;
}

/**
 * Заполненные анкеты сгруппированы по дню. Выбор — в адресе `?id=`.
 */
export const RegistryList = ({
  items,
  selectedId,
  clinicId,
  utcOffsetMinutes,
}: RegistryListProps) => (
  <div className="flex flex-col gap-4 px-3">
    {groupRegistryByCompletionDay(items, utcOffsetMinutes).map(
      ([day, entries]) => (
        <section key={day} aria-labelledby={`registry-day-${day}`}>
          <h2
            id={`registry-day-${day}`}
            className="mb-2 py-2 text-sm font-medium"
          >
            {formatDateLabel(day)}
          </h2>
          <ul className="flex flex-col gap-1">
            {entries.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <Link
                    href={`/registry?id=${encodeURIComponent(item.id)}${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`}
                    scroll={false}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-[var(--ui-space-10)] text-[length:var(--ui-font-size-14)] text-[var(--ui-color-alabaster-dark-800)] transition-colors ${
                      isSelected ? 'bg-white' : 'hover:bg-white'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {patientFullName(item)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ),
    )}
  </div>
);
