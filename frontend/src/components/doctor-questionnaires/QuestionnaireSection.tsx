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
        className="pl-6 text-[32px] leading-tight font-medium text-[#202020]"
      >
        {section.title}
      </h2>

      <div className="flex items-center">
        <div className="flex w-8 shrink-0 justify-start pl-1.5">
          {!section.isEmpty && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Скопировать раздел «${section.title}»`}
              className="-mx-1.25 cursor-pointer rounded px-1.25 opacity-70 transition-opacity hover:opacity-100"
            >
              <Image src="/copy.svg" alt="" width={16} height={16} />
            </button>
          )}
        </div>
        {section.isEmpty ? (
          <p className="text-base text-[#8B8B8B]">Пациент не ответил</p>
        ) : (
          <p className="text-base whitespace-pre-line text-[#202020]">
            {section.text}
          </p>
        )}
      </div>

      {section.gaps.length > 0 && (
        <div className="ml-8 w-fit max-w-full rounded-[15px] bg-[#F3F4F8] px-3 py-2.5">
          <p className="text-[14px] font-medium text-[#5D8CF1]">
            Что доспросить?
          </p>
          <ul className="mt-1 list-disc pl-5 text-[13px] leading-snug text-[#6C757D] marker:text-[#8B8B8B]">
            {section.gaps.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
