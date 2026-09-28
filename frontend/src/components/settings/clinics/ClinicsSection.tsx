'use client';

import { useState } from 'react';
import { ClinicsList } from './ClinicsList';
import { ClinicCard } from './ClinicCard';

type View = { view: 'list' } | { view: 'card'; clinicId: string | null };

interface ClinicsSectionProps {
  /** Меняется при повторном клике по «Клиникам» в меню — возврат к списку. */
  resetKey: number;
}

export const ClinicsSection = ({ resetKey }: ClinicsSectionProps) => {
  const [state, setState] = useState<{ view: View; resetKey: number }>({
    view: { view: 'list' },
    resetKey,
  });

  // Возврат к списку — производное от resetKey, без эффекта синхронизации.
  const current: View =
    state.resetKey === resetKey ? state.view : { view: 'list' };

  const show = (view: View) => setState({ view, resetKey });

  if (current.view === 'list') {
    return (
      <ClinicsList
        onOpen={(clinicId) => show({ view: 'card', clinicId })}
        onCreate={() => show({ view: 'card', clinicId: null })}
      />
    );
  }

  // key: новая карточка и карточка другой клиники — отдельные экземпляры
  // со своей очередью сохранений.
  return (
    <ClinicCard
      key={current.clinicId ?? `new-${resetKey}`}
      clinicId={current.clinicId}
    />
  );
};
