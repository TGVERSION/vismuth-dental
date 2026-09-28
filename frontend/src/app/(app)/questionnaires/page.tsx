import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QuestionnairesScreen } from '@/components/doctor-questionnaires/QuestionnairesScreen';

export const metadata: Metadata = {
  title: 'Анкеты',
};

/**
 * Раздел «Анкеты» у врача. Серверная обёртка ради заголовка вкладки; экран —
 * клиентский. `Suspense` обязателен: экран читает `?id=` через
 * `useSearchParams`, и без границы сборка не сможет пререндерить страницу.
 */
export default function QuestionnairesPage() {
  return (
    <Suspense fallback={null}>
      <QuestionnairesScreen />
    </Suspense>
  );
}
