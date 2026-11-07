'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { QuestionnaireVisitType } from '@/api';
import { useDoctorQuestionnaire } from '@/hooks/useDoctorQuestionnaire';
import { useDoctorQuestionnaireList } from '@/hooks/useDoctorQuestionnaireList';
import { useNow } from '@/hooks/useNow';
import { toDateInputValue } from '@/lib/questionnaire';
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
  // Дата выбрана всегда: её можно сменить, но не очистить.
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [visitType, setVisitType] = useState<QuestionnaireVisitType | ''>('');

  const now = useNow();
  const list = useDoctorQuestionnaireList({ search, date, visitType });
  const questionnaire = useDoctorQuestionnaire(selectedId);

  const renderDetail = () => {
    if (!selectedId) {
      return (
        <p className="mt-40 text-center text-[var(--ui-color-alabaster-950)]">
          Выберите анкету в списке
        </p>
      );
    }

    let content: React.ReactNode;
    if (questionnaire.isLoading) {
      content = (
        <div className="mx-auto my-40 h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--ui-color-blue-600)]" />
      );
    } else if (questionnaire.error === 'forbidden') {
      content = (
        <p className="my-40 text-center text-[var(--ui-color-alabaster-950)]">
          Раздел доступен врачам клиники
        </p>
      );
    } else if (questionnaire.error === 'not_found') {
      content = (
        <p className="my-40 text-center text-[var(--ui-color-alabaster-950)]">
          Анкета не найдена
        </p>
      );
    } else if (questionnaire.error || !questionnaire.data) {
      content = (
        <div className="my-40 flex flex-col items-center gap-3 text-center">
          <p className="text-[var(--ui-color-red-600)]">
            Не удалось загрузить анкету
          </p>
          <button
            type="button"
            onClick={questionnaire.reload}
            className="cursor-pointer text-[var(--ui-color-blue-600)] hover:text-[var(--ui-color-blue-700)]"
          >
            Повторить
          </button>
        </div>
      );
    } else {
      content = <QuestionnaireCard questionnaire={questionnaire.data} />;
    }

    // Своя прокрутка карточки: в защищённой зоне прокрутка `body`
    // заблокирована, и без неё кнопка протокола на длинной анкете недостижима.
    return (
      <div className="custom-scrollbar max-h-[calc(100vh-100px)] w-full max-w-246 self-start overflow-y-auto rounded-2xl bg-white px-8 py-6">
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
        visitType={visitType}
        onVisitTypeChange={setVisitType}
        items={list.items}
        isInitialLoading={list.isInitialLoading}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.retry}
        selectedId={selectedId}
        now={now}
      />

      <div className="ml-[var(--ui-space-64)] flex min-w-0 flex-1 justify-center pr-5">
        {renderDetail()}
      </div>
    </>
  );
};
