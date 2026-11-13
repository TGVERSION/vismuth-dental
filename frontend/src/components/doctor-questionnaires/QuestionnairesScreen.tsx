'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuestionnaireDates } from '@/hooks/useQuestionnaireDates';
import { useDoctorQuestionnaire } from '@/hooks/useDoctorQuestionnaire';
import { useDoctorQuestionnaireList } from '@/hooks/useDoctorQuestionnaireList';
import { parseSearchQuery } from '@/lib/doctor-questionnaires';
import { QuestionnaireCard } from './QuestionnaireCard';
import { QuestionnaireListColumn } from './QuestionnaireListColumn';

/**
 * Раздел «Анкеты»: список слева, открытая анкета справа.
 *
 * Выбранная анкета — в адресе (`?id=`): обновление страницы и «назад»
 * сохраняют её, как у протоколов. Фильтры — в состоянии экрана.
 */
export const QuestionnairesScreen = () => {
  const selectedId = useSearchParams().get('id');

  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [utcOffsetMinutes] = useState(() => -new Date().getTimezoneOffset());
  const markedDates = useQuestionnaireDates('/questionnaires', {
    ...parseSearchQuery(search),
    exclude_dental: 'true',
  });

  const list = useDoctorQuestionnaireList({
    search,
    date,
    visitType: '',
  });
  const questionnaire = useDoctorQuestionnaire(selectedId);

  const renderDetail = () => {
    if (!selectedId) {
      return (
        <p className="mt-40 text-center text-[#8B8B8B]">
          Выберите анкету в списке
        </p>
      );
    }

    let content: React.ReactNode;
    if (questionnaire.isLoading) {
      content = (
        <div className="mx-auto my-40 h-10 w-10 animate-spin rounded-full border-b-2 border-[#5D8CF1]" />
      );
    } else if (questionnaire.error === 'forbidden') {
      content = (
        <p className="my-40 text-center text-[#8B8B8B]">
          Раздел доступен врачам клиники
        </p>
      );
    } else if (
      questionnaire.error === 'not_found' ||
      questionnaire.data?.kind === 'dental'
    ) {
      content = (
        <p className="my-40 text-center text-[#8B8B8B]">Анкета не найдена</p>
      );
    } else if (questionnaire.error || !questionnaire.data) {
      content = (
        <div className="my-40 flex flex-col items-center gap-3 text-center">
          <p className="text-[#D91528]">Не удалось загрузить анкету</p>
          <button
            type="button"
            onClick={questionnaire.reload}
            className="cursor-pointer text-[#5D8CF1] hover:text-[#769CEF]"
          >
            Повторить
          </button>
        </div>
      );
    } else {
      content = (
        <QuestionnaireCard
          key={questionnaire.data.id}
          questionnaire={questionnaire.data}
        />
      );
    }

    // Своя прокрутка карточки: в защищённой зоне прокрутка `body`
    // заблокирована, и без неё кнопка протокола на длинной анкете недостижима.
    return (
      <div className="custom-scrollbar max-h-[calc(100dvh-140px)] min-w-0 w-full max-w-246 self-start overflow-x-hidden overflow-y-auto rounded-2xl bg-white px-4 py-6 min-[1200px]:max-h-[calc(100dvh-100px)] 2xl:px-8">
        {content}
      </div>
    );
  };

  return (
    <>
      <h1 className="sr-only">Анкеты для врачей</h1>

      <QuestionnaireListColumn
        search={search}
        onSearchChange={setSearch}
        date={date}
        onDateChange={setDate}
        markedDates={markedDates}
        items={list.items}
        isInitialLoading={list.isInitialLoading}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.retry}
        selectedId={selectedId}
        utcOffsetMinutes={utcOffsetMinutes}
      />

      <div className="ml-93.5 flex min-w-0 flex-1 justify-center pr-5">
        {renderDetail()}
      </div>
    </>
  );
};
