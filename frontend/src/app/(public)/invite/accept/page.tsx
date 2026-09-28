import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InviteAcceptForm } from '@/components/invite/InviteAcceptForm';

export const metadata: Metadata = {
  title: 'Приглашение в клинику',
  // Страница открывается по личной ссылке с токеном — в поиске ей не место.
  robots: { index: false, follow: false },
};

// useSearchParams в клиентской форме требует границы Suspense, иначе
// статическая генерация страницы при сборке падает.
export default function InviteAcceptPage() {
  return (
    <Suspense fallback={null}>
      <InviteAcceptForm />
    </Suspense>
  );
}
