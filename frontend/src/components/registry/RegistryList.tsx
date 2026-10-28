'use client';

import Link from 'next/link';
import type { RegistryQuestionnaireItem } from '@/api';
import { patientFullName, registryStatusView, registryWhenLine } from '@/lib/registry';

interface RegistryListProps {
  items: RegistryQuestionnaireItem[];
  selectedId: string | null;
}

/** Анкеты: пациент, когда заполнена (или до какого срока ссылка) и статус. Выбор — в адресе `?id=`. */
export const RegistryList = ({ items, selectedId }: RegistryListProps) => (
  <ul className="flex flex-col gap-1">
    {items.map((item) => {
      const status = registryStatusView(item.status);
      const isSelected = item.id === selectedId;
      return (
        <li key={item.id}>
          <Link
            href={`/registry?id=${encodeURIComponent(item.id)}`}
            scroll={false}
            aria-current={isSelected ? 'true' : undefined}
            className={`flex flex-col gap-1 rounded-xl px-4 py-3 transition-colors ${
              isSelected ? 'bg-[#EAF0FB]' : 'bg-white hover:bg-[#F7F9FB]'
            }`}
          >
            <span className="truncate text-[15px] text-[#202020]">{patientFullName(item)}</span>
            <span className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-[#6C757D]">
                {registryWhenLine(item)}
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                {status.label}
              </span>
            </span>
          </Link>
        </li>
      );
    })}
  </ul>
);
