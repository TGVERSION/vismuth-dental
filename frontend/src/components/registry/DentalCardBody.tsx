'use client';

import type { DoctorQuestionnaireStructured } from '@/api';

interface DentalCardBodyProps {
  structured: DoctorQuestionnaireStructured;
  gaps: string[] | null;
}

/** Только первая буква: «Гепатит, ВИЧ…» → «гепатит, ВИЧ…», аббревиатуры целы. */
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-t border-[#EEF0F3] py-3 first:border-t-0">
    <h3 className="pt-0.5 text-sm font-medium text-[#6C757D]">{title}</h3>
    <div className="flex min-w-0 flex-col gap-2 text-[15px] text-[#202020]">{children}</div>
  </section>
);

/**
 * Карточка стоматологической анкеты: то же, что врач видит на экране и
 * регистратура печатает. Собрана правилами на backend — здесь только показ.
 */
export const DentalCardBody = ({ structured, gaps }: DentalCardBodyProps) => {
  const important = structured.important ?? [];
  const health = structured.health ?? [];
  const has = health.filter((row) => row.has);
  const hasNot = health.filter((row) => !row.has);

  return (
    <div className="flex flex-col">
      <Section title="Самое важное">
        {important.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {important.map((line) => (
              <li key={line} className="rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#8E1F1F]">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-[#E6F4EC] px-3 py-2 text-sm text-[#14603B]">
            Ничего опасного для лечения не отмечено
          </p>
        )}
      </Section>

      <Section title="С чем пришёл">
        <p>{structured.complaints || '—'}</p>
      </Section>

      <Section title="Здоровье">
        {has.map((row) => (
          <p key={row.key}>
            <span className="font-medium">{row.label}</span>
            {row.detail ? `: ${row.detail}` : ''}
          </p>
        ))}
        {hasNot.length > 0 ? (
          <p className="text-sm text-[#6C757D]">
            Нет: {hasNot.map((row) => lowerFirst(row.label)).join(', ')}
          </p>
        ) : null}
      </Section>

      <Section title="Препараты">
        <p>{structured.medications || '—'}</p>
      </Section>

      <Section title="Аллергия">
        <p>{structured.allergy_anamnesis || '—'}</p>
      </Section>

      {gaps && gaps.length > 0 ? (
        <Section title="Что доспросить">
          <ul className="list-disc pl-5 text-sm text-[#4E2C80]">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
};
