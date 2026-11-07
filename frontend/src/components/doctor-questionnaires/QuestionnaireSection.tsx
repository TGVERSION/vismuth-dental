'use client';

import Image from 'next/image';
import { useId } from 'react';
import { toast } from 'react-toastify';
import { copyText } from '@/lib/clipboard';
import type { QuestionnaireSectionView } from '@/lib/doctor-questionnaires';
import { logWarn } from '@/lib/logger';

interface QuestionnaireSectionProps {
  section: QuestionnaireSectionView;
}

/**
 * Раздел анкеты: заголовок, текст с кнопкой копирования и, если есть,
 * «Что доспросить?». Текст — только React-рендеринг: он пришёл с сервера и
 * написан пациентом.
 */
export const QuestionnaireSection = ({
  section,
}: QuestionnaireSectionProps) => {
  const headingId = useId();

  const handleCopy = async () => {
    try {
      await copyText(section.text);
      toast.success('Скопировано');
    } catch (error) {
      // Браузер не дал скопировать ни одним способом. Текст раздела на
      // экране, его можно выделить вручную.
      logWarn('Анкеты: копирование раздела недоступно', error);
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2
        id={headingId}
        className="pl-6 text-[length:var(--ui-font-size-31)] font-medium text-[var(--ui-color-alabaster-dark-800)]"
      >
        {section.title}
      </h2>

      <div className="flex items-center">
        <div className="flex w-8 shrink-0 justify-start pl-[var(--ui-space-6)]">
          {!section.isEmpty && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Скопировать раздел «${section.title}»`}
              className="-mx-[var(--ui-space-4)] cursor-pointer rounded px-[var(--ui-space-4)] opacity-70 transition-opacity hover:opacity-100"
            >
              <Image src="/copy.svg" alt="" width={16} height={16} />
            </button>
          )}
        </div>
        {section.isEmpty ? (
          <p className="text-base text-[var(--ui-color-alabaster-950)]">
            Пациент не ответил
          </p>
        ) : (
          <p className="text-base whitespace-pre-line text-[var(--ui-color-alabaster-dark-800)]">
            {section.text}
          </p>
        )}
      </div>

      {section.gaps.length > 0 && (
        <div className="ml-8 w-fit max-w-full rounded-2xl bg-[var(--ui-color-slate-100)] px-3 py-[var(--ui-space-10)]">
          <p className="text-[length:var(--ui-font-size-14)] font-medium text-[var(--ui-color-blue-600)]">
            Что доспросить?
          </p>
          <ul className="mt-1 list-disc pl-5 text-[length:var(--ui-font-size-13)] text-[var(--ui-color-alabaster-950)] marker:text-[var(--ui-color-alabaster-950)]">
            {section.gaps.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
