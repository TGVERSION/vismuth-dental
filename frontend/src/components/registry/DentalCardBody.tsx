'use client';

import type { DoctorQuestionnaireStructured } from '@/api';
import {
  DentalClarifications,
  DentalHealth,
  DentalHistory,
  DentalImportant,
} from '@/components/dental-card/DentalCardParts';
import { gapQuestions } from '@/lib/doctor-questionnaires';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-t border-[#EEF0F3] py-3 first:border-t-0">
    <h3 className="pt-0.5 text-sm font-medium text-[#6C757D]">{title}</h3>
    <div className="flex min-w-0 flex-col gap-2 text-[15px] text-[#202020]">{children}</div>
  </section>
);

interface DentalCardBodyProps {
  structured: DoctorQuestionnaireStructured;
  gaps: unknown[] | null;
}

/**
 * Карточка стоматологической анкеты у регистратуры. Собрана правилами на
 * backend — здесь только показ. Врач видит те же «Самое важное» и здоровье
 * над привычными разделами с копированием (`QuestionnaireCard`).
 */
export const DentalCardBody = ({ structured, gaps }: DentalCardBodyProps) => {
  const questions = gapQuestions(gaps);
  return (
    <div className="flex flex-col">
      <Section title="Самое важное">
        <DentalImportant important={structured.important ?? []} />
      </Section>
      <Section title="С чем пришёл">
        <p>{structured.complaints || '—'}</p>
      </Section>
      {structured.clarifications && structured.clarifications.length > 0 ? (
        <Section title="Уточнения">
          <DentalClarifications items={structured.clarifications} />
        </Section>
      ) : null}
      <Section title="Здоровье">
        <DentalHealth health={structured.health ?? []} />
      </Section>
      {structured.dental_history ? (
        <Section title="Зубы и дёсны">
          <DentalHistory history={structured.dental_history} />
        </Section>
      ) : null}
      <Section title="Препараты">
        <p>{structured.medications || '—'}</p>
      </Section>
      <Section title="Аллергия">
        <p>{structured.allergy_anamnesis || '—'}</p>
      </Section>
      {questions.length > 0 ? (
        <Section title="Что доспросить">
          <ul className="list-disc pl-5 text-sm text-[#4E2C80]">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
};
