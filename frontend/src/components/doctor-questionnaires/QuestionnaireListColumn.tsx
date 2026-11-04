'use client';

import type {
  DoctorQuestionnaireListItem,
  QuestionnaireVisitType,
} from '@/api';
import type { QuestionnaireListError } from '@/hooks/useDoctorQuestionnaireList';
import { formatDateLabel } from '@/lib/calendar';
import { LinksQrButton } from './LinksQrButton';
import { QuestionnaireFilters } from './QuestionnaireFilters';
import { QuestionnaireListItem } from './QuestionnaireListItem';

interface QuestionnaireListColumnProps {
  search: string;
  onSearchChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  visitType: QuestionnaireVisitType | '';
  onVisitTypeChange: (value: QuestionnaireVisitType | '') => void;
  items: DoctorQuestionnaireListItem[];
  isInitialLoading: boolean;
  isLoading: boolean;
  error: QuestionnaireListError | null;
  onRetry: () => void;
  selectedId: string | null;
  now: Date;
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
  visitType,
  onVisitTypeChange,
  items,
  isInitialLoading,
  isLoading,
  error,
  onRetry,
  selectedId,
  now,
}: QuestionnaireListColumnProps) => {
  const hasFilters = search.trim() !== '' || visitType !== '';

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
          {hasFilters ? 'Ничего не найдено' : 'Анкет на эту дату нет'}
        </p>
      );
    }

    return (
      <ul
        aria-busy={isLoading}
        className={`flex flex-col gap-1.25 transition-opacity ${
          isLoading ? 'opacity-60' : ''
        }`}
      >
        {items.map((item) => (
          <li key={item.id}>
            <QuestionnaireListItem
              item={item}
              selected={item.id === selectedId}
              now={now}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <aside
      data-print-hide
      aria-label="Анкеты для врачей"
      className="custom-height fixed top-20 left-0 ml-3 mr-5 flex w-85.75 flex-col bg-[#F3F4F8]"
    >
      <LinksQrButton />

      <div className="mt-6">
        <QuestionnaireFilters
          search={search}
          onSearchChange={onSearchChange}
          date={date}
          onDateChange={onDateChange}
          visitType={visitType}
          onVisitTypeChange={onVisitTypeChange}
        />
      </div>

      <div className="custom-scrollbar mt-6 flex-1 overflow-x-hidden overflow-y-auto">
        <h2 className="px-0 py-2.25 text-[14px] font-medium">
          {formatDateLabel(date)}
        </h2>
        {renderBody()}
      </div>
    </aside>
  );
};
