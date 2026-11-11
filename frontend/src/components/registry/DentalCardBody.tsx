'use client';

import type { DoctorQuestionnaireStructured } from '@/api';
import {
  DentalBlock as Block,
  DentalClarifications,
  DentalHealth,
  DentalImportant,
  QuestionnaireQuestions,
} from '@/components/dental-card/DentalCardParts';
import { gapQuestions } from '@/lib/doctor-questionnaires';
import { dentalSummaryText } from '@/lib/dental-health';

interface DentalCardBodyProps {
  structured: DoctorQuestionnaireStructured;
  gaps: unknown[] | null;
}

/**
 * Карточка стоматологической анкеты у регистратуры. Собрана правилами на
 * backend — здесь только показ, разделами того же вида, что у врача.
 */
export const DentalCardBody = ({ structured, gaps }: DentalCardBodyProps) => {
  const questions = gapQuestions(gaps);
  const complaints = dentalSummaryText(structured.complaints);
  const medications = dentalSummaryText(structured.medications);
  const allergy = dentalSummaryText(structured.allergy_anamnesis);
  return (
    <div className="flex flex-col gap-9">
      <DentalImportant important={structured.important ?? []} />
      {complaints && (
        <Block title="С чем пришёл">
          <p>{complaints}</p>
        </Block>
      )}
      {structured.clarifications && structured.clarifications.length > 0 ? (
        <Block title="Уточнения">
          <DentalClarifications items={structured.clarifications} />
        </Block>
      ) : null}
      <DentalHealth health={structured.health ?? []} />
      {structured.about ? (
        <Block title="О пациенте">
          <p>{structured.about}</p>
        </Block>
      ) : null}
      {medications && (
        <Block title="Препараты">
          <p>{medications}</p>
        </Block>
      )}
      {allergy && (
        <Block title="Аллергия">
          <p>{allergy}</p>
        </Block>
      )}
      <QuestionnaireQuestions questions={questions} />
    </div>
  );
};
