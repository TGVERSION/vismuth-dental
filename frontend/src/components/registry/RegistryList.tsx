'use client';

import Link from 'next/link';
import type { RegistryQuestionnaireItem } from '@/api';
import { patientFullName, registryWhenLine } from '@/lib/registry';
import { RegistryStatusBadge } from './RegistryStatusBadge';

interface RegistryListProps {
  items: RegistryQuestionnaireItem[];
  selectedId: string | null;
  clinicId?: string | null;
}

/**
 * Анкеты: пациент, когда заполнена (или до какого срока ссылка) и статус.
 * Строки — как в списке анкет у врача. Выбор — в адресе `?id=`.
 */
export const RegistryList = ({
  items,
  selectedId,
  clinicId,
}: RegistryListProps) => (
  <ul className="flex flex-col gap-[var(--ui-space-4)]">
    {items.map((item) => {
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
            <span className="min-w-0 flex-1">
              <span className="block truncate">{patientFullName(item)}</span>
              <span className="block truncate text-[var(--ui-color-alabaster-950)]">
                {registryWhenLine(item)}
              </span>
            </span>
            <RegistryStatusBadge status={item.status} />
          </Link>
        </li>
      );
    })}
  </ul>
);
