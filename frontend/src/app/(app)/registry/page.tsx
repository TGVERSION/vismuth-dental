import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegistryScreen } from '@/components/registry/RegistryScreen';

export const metadata: Metadata = {
  title: 'Анкеты пациентов',
};

/**
 * Раздел регистратуры стоматологической клиники. Серверная обёртка ради
 * заголовка вкладки; `Suspense` нужен экрану, читающему `?id=`.
 */
export default function RegistryPage() {
  return (
    <Suspense fallback={null}>
      <RegistryScreen />
    </Suspense>
  );
}
