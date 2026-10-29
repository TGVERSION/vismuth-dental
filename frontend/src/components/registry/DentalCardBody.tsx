'use client';

import type { DoctorQuestionnaireStructured } from '@/api';
import {
  DentalBlock as Block,
  DentalClarifications,
  DentalHealth,
  DentalImportant,
} from '@/components/dental-card/DentalCardParts';
import { gapQuestions } from '@/lib/doctor-questionnaires';

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
  return (
    <div className="flex flex-col gap-9">
      <Block title="Самое важное">
        <DentalImportant important={structured.important ?? []} />
      </Block>
      <Block title="С чем пришёл">
        <p>{structured.complaints || '—'}</p>
      </Block>
      {structured.clarifications && structured.clarifications.length > 0 ? (
        <Block title="Уточнения">
          <DentalClarifications items={structured.clarifications} />
        </Block>
      ) : null}
      <Block title="Здоровье">
        <DentalHealth health={structured.health ?? []} />
      </Block>
      {structured.about ? (
        <Block title="О пациенте">
          <p>{structured.about}</p>
        </Block>
      ) : null}
      <Block title="Препараты">
        <p>{structured.medications || '—'}</p>
      </Block>
      <Block title="Аллергия">
        <p>{structured.allergy_anamnesis || '—'}</p>
      </Block>
      {/* «Что доспросить» — как подсказка под разделом анкеты у врача. */}
      {questions.length > 0 ? (
        <div className="ml-8 w-fit max-w-full rounded-[15px] bg-[#F3F4F8] px-3 py-2.5">
          <p className="text-[14px] font-medium text-[#5D8CF1]">
            Что доспросить
          </p>
          <ul className="mt-1 list-disc pl-5 text-[13px] text-[#6C757D] marker:text-[#8B8B8B]">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
