'use client';

import type { RegistryStatus } from '@/api';
import { registryStatusView } from '@/lib/registry';

// Классы живут здесь, а не в lib/registry.ts: Tailwind собирает классы
// только из файлов, которые видит, а `lib/` закрыта .gitignore.
const STATUS_CLASS: Record<RegistryStatus, string> = {
  invited: 'bg-[#F1F2F6] text-[#6C757D]',
  in_progress: 'bg-[#FFF4DB] text-[#8A5A00]',
  completed: 'bg-[#EAF0FB] text-[#2A5AB0]',
  printed: 'bg-[#F3ECFC] text-[#6A3FA6]',
  signed: 'bg-[#E6F4EC] text-[#14603B]',
};

/** Плашка статуса анкеты в списке и карточке регистратуры. */
export const RegistryStatusBadge = ({ status }: { status: RegistryStatus }) => (
  <span
    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
  >
    {registryStatusView(status).label}
  </span>
);
