'use client';

import { useId } from 'react';
import type { DoctorQuestionnaireStructured } from '@/api';
import { DentalHealth, DentalImportant } from '@/components/dental-card/DentalCardParts';

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="pl-6 text-[32px] font-medium text-[#202020]">
        {title}
      </h2>
      <div className="flex flex-col gap-2 pl-8 text-base text-[#202020]">{children}</div>
    </section>
  );
};

/**
 * Стоматологическая анкета у врача: «Самое важное» и сводка здоровья над
 * привычными разделами. Риски — первыми: врач должен увидеть разжижающие
 * кровь и аллергию до лечения, не читая всю анкету.
 */
export const DentalDoctorSummary = ({
  structured,
}: {
  structured: DoctorQuestionnaireStructured;
}) => (
  <>
    <Block title="Самое важное">
      <DentalImportant important={structured.important ?? []} />
    </Block>
    <Block title="Здоровье">
      <DentalHealth health={structured.health ?? []} />
    </Block>
  </>
);
