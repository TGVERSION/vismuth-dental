'use client';

import type { DoctorQuestionnaireListItem } from '@/api';
import type { QuestionnaireListError } from '@/hooks/useDoctorQuestionnaireList';
import { useMyClinic } from '@/hooks/useMyClinic';
import { CompletedQuestionnaireList } from './CompletedQuestionnaireList';
import { LinksQrButton } from './LinksQrButton';
import { QuestionnaireFilters } from './QuestionnaireFilters';

interface QuestionnaireListColumnProps {
  search: string;
  onSearchChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  markedDates: readonly string[];
  items: DoctorQuestionnaireListItem[];
  isInitialLoading: boolean;
  isLoading: boolean;
  error: QuestionnaireListError | null;
  onRetry: () => void;
  selectedId: string | null;
  utcOffsetMinutes: number;
}

/**
 * Левая колонка раздела «Анкеты». Размеры и отступы — те же, что у колонки
 * протоколов в `(app)/page.tsx`: при переключении разделов колонка не прыгает.
 */
export const QuestionnaireListColumn = ({
  search,
  onSearchChange,
  date,
  onDateChange,
  markedDates,
  items,
  isInitialLoading,
  isLoading,
  error,
  onRetry,
  selectedId,
  utcOffsetMinutes,
}: QuestionnaireListColumnProps) => {
  const { clinic } = useMyClinic();
  const hasFilters = Boolean(search.trim() || date);

  const renderBody = () => {
    // На повторной загрузке прежние строки остаются на месте, но если их нет —
    // после «Повторить» или при смене дня без анкет — колонка опустела бы.
    if (isInitialLoading || (isLoading && items.length === 0)) {
      return (
        <div className="mx-auto my-40 h-10 w-10 animate-spin rounded-full border-b-2 border-[#5D8CF1]" />
      );
    }

    if (error === 'forbidden') {
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          Раздел доступен врачам клиники
        </p>
      );
    }

    if (error === 'failed') {
      return (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm">
          <p className="text-[#D91528]">Не удалось загрузить анкеты</p>
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer text-[#5D8CF1] hover:text-[#769CEF]"
          >
            Повторить
          </button>
        </div>
      );
    }

    if (items.length === 0 && !isLoading) {
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          {hasFilters ? 'Ничего не найдено' : 'Заполненных анкет пока нет'}
        </p>
      );
    }

    return (
      <div
        aria-busy={isLoading}
        className={`flex flex-col gap-1.25 transition-opacity ${
          isLoading ? 'opacity-60' : ''
        }`}
      >
        <CompletedQuestionnaireList
          items={items}
          selectedId={selectedId}
          utcOffsetMinutes={utcOffsetMinutes}
          showAppointmentTime
          groupByAppointment
          hrefFor={(id) => `/questionnaires?id=${encodeURIComponent(id)}`}
        />
      </div>
    );
  };

  return (
    <aside
      data-print-hide
      aria-label="Анкеты для врачей"
      className="fixed top-[120px] bottom-5 left-0 ml-3 mr-5 flex min-h-0 w-85.75 flex-col bg-[var(--ui-color-slate-100)] min-[1200px]:top-20"
    >
      {clinic?.is_clinic_admin && <LinksQrButton />}

      <div className={clinic?.is_clinic_admin ? 'mt-6 shrink-0' : 'shrink-0'}>
        <QuestionnaireFilters
          search={search}
          onSearchChange={onSearchChange}
          date={date}
          onDateChange={onDateChange}
          markedDates={markedDates}
          dateLabel="Дата приёма"
          searchLabel="ФИО пациента или код"
          onClearDate={() => onDateChange('')}
        />
      </div>

      <div className="custom-scrollbar mt-6 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {renderBody()}
      </div>
    </aside>
  );
};
