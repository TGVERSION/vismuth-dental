'use client';

import type { RegistryStatus } from '@/api';
import { registryStatusView } from '@/lib/registry';

// Классы живут здесь, а не в lib/registry.ts: Tailwind собирает классы
// только из файлов, которые видит, а `lib/` закрыта .gitignore.
const STATUS_CLASS: Record<RegistryStatus, string> = {
  invited:
    'bg-[var(--ui-color-slate-100)] text-[var(--ui-color-alabaster-950)]',
  in_progress:
    'bg-[var(--ui-color-yellow-50)] text-[var(--ui-color-yellow-800)]',
  completed: 'bg-[var(--ui-color-blue-100)] text-[var(--ui-color-blue-800)]',
  printed: 'bg-[var(--ui-color-purple-100)] text-[var(--ui-color-purple-800)]',
  signed: 'bg-[var(--ui-color-alabaster-500)] text-[var(--ui-color-green-800)]',
};

/** Плашка статуса анкеты в списке и карточке регистратуры. */
export const RegistryStatusBadge = ({ status }: { status: RegistryStatus }) => (
  <span
    className={`shrink-0 rounded-full px-[var(--ui-space-10)] py-[var(--ui-space-2)] text-xs font-medium ${STATUS_CLASS[status]}`}
  >
    {registryStatusView(status).label}
  </span>
);
