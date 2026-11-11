'use client';

import type { DoctorQuestionnaireStructured } from '@/api';
import {
  DentalBlock as Block,
  DentalClarifications,
  DentalHealth,
  DentalImportant,
} from '@/components/dental-card/DentalCardParts';

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
    <DentalImportant important={structured.important ?? []} />
    <DentalHealth health={structured.health ?? []} />
    {structured.about ? (
      <Block title="О пациенте">
        <p>{structured.about}</p>
      </Block>
    ) : null}
    {structured.clarifications && structured.clarifications.length > 0 ? (
      <Block title="Уточнения">
        <DentalClarifications items={structured.clarifications} />
      </Block>
    ) : null}
  </>
);
