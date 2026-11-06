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
  <ul className="flex flex-col gap-1.25">
    {items.map((item) => {
      const isSelected = item.id === selectedId;
      return (
        <li key={item.id}>
          <Link
            href={`/registry?id=${encodeURIComponent(item.id)}${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`}
            scroll={false}
            aria-current={isSelected ? 'true' : undefined}
            className={`flex items-center gap-3 rounded-[15px] px-3 py-2.5 text-[14px] text-[#202020] transition-colors ${
              isSelected ? 'bg-white' : 'hover:bg-white'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{patientFullName(item)}</span>
              <span className="block truncate text-[#8B8B8B]">
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
