'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mainApi, type ClinicRead } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { CustomDropdown } from '@/components/CustomDropdown';
import { ErrorState, Spinner } from '@/components/settings/clinics/fields';
import { useMyClinic } from '@/hooks/useMyClinic';
import { useRegistryDetail, useRegistryList } from '@/hooks/useRegistry';
import { canUseRegistry } from '@/lib/app-nav';
import { QuestionnaireFilters } from '@/components/doctor-questionnaires/QuestionnaireFilters';
import { useQuestionnaireDates } from '@/hooks/useQuestionnaireDates';
import { toDateInputValue } from '@/lib/questionnaire';
import { formatDateLabel } from '@/lib/calendar';
import { NewLinkModal } from './NewLinkModal';
import { RegistryDetail } from './RegistryDetail';
import { RegistryList } from './RegistryList';

/** Поиск по ФИО уходит на сервер после паузы в наборе, а не на каждую букву. */
const SEARCH_DEBOUNCE_MS = 300;
/**
 * Регистратура держит список открытым и ждёт, пока пациенты заполнят
 * анкеты: статусы обновляются сами, без перезагрузки страницы.
 */
const REFRESH_MS = 30000;

const useDebounced = (value: string, delay: number): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/** Тихое обновление по таймеру и при возврате на вкладку. */
const useAutoRefresh = (refresh: () => void) => {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);
};

/**
 * Раздел «Анкеты пациентов» регистратуры: слева фильтры и анкеты (новые
 * сверху), справа открытая анкета. Выбранная анкета — в адресе (`?id=`).
 */
export const RegistryScreen = () => {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('id');
  const superAdmin = useAuthStore((s) => s.user?.role) === 'super_admin';
  const [clinics, setClinics] = useState<ClinicRead[]>([]);
  const [clinicListError, setClinicListError] = useState('');
  useEffect(() => {
    if (superAdmin)
      mainApi.clinics
        .list()
        .then((c) =>
          setClinics(
            c.filter(
              (v) => v.questionnaire_kind !== 'general' && !v.deleted_at,
            ),
          ),
        )
        .catch(() => setClinicListError('Не удалось загрузить клиники'));
  }, [superAdmin]);
  const selectedClinic = superAdmin
    ? (params.get('clinic_id') ?? clinics[0]?.id ?? null)
    : null;
  const {
    clinic,
    isLoading: isClinicLoading,
    error: clinicError,
  } = useMyClinic();
  const clinicId = superAdmin
    ? selectedClinic
    : canUseRegistry(clinic) && clinic
      ? clinic.clinic_id
      : null;

  const [name, setName] = useState('');
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [utcOffset] = useState(() => -new Date().getTimezoneOffset());
  const [calendarVersion, setCalendarVersion] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const searchName = useDebounced(name.trim(), SEARCH_DEBOUNCE_MS);
  const query = useMemo(
    () => ({
      ...(searchName ? { name: searchName } : {}),
      ...(date ? { completed_on: date, utc_offset_minutes: utcOffset } : {}),
    }),
    [searchName, date, utcOffset],
  );
  const markedDates = useQuestionnaireDates(
    clinicId ? `/clinics/${clinicId}/questionnaires` : null,
    {
      ...(searchName ? { name: searchName } : {}),
      utc_offset_minutes: String(utcOffset),
    },
    'completion-dates',
    calendarVersion,
  );
  const list = useRegistryList(clinicId, query);
  const detail = useRegistryDetail(clinicId, selectedId);
  const { reload: reloadList } = list;
  const { reload: reloadDetail } = detail;
  const refreshAll = useCallback(() => {
    reloadList();
    reloadDetail();
    setCalendarVersion((version) => version + 1);
  }, [reloadList, reloadDetail]);
  useAutoRefresh(refreshAll);

  const select = (id: string | null) =>
    router.replace(
      `/registry?${new URLSearchParams({ ...(superAdmin && clinicId ? { clinic_id: clinicId } : {}), ...(id ? { id } : {}) }).toString()}`,
      { scroll: false },
    );

  if (!superAdmin && isClinicLoading) return <Spinner />;
  if (!superAdmin && clinicError === 'failed') {
    return (
      <ErrorState
        text="Не удалось загрузить данные клиники"
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (!clinicId) {
    return (
      <p className="mx-auto mt-40 max-w-md text-center text-[var(--ui-color-alabaster-950)]">
        {superAdmin
          ? clinicListError || 'Нет доступных стоматологических клиник'
          : 'Раздел доступен администратору или оператору стоматологической клиники'}
      </p>
    );
  }

  const renderList = () => {
    if (list.isLoading && list.items.length === 0) return <Spinner />;
    if (list.error && list.items.length === 0) {
      return (
        <ErrorState text="Не удалось загрузить анкеты" onRetry={list.reload} />
      );
    }
    if (list.items.length === 0) {
      const isFiltered = Boolean(searchName || date);
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          {isFiltered
            ? 'Ничего не найдено'
            : 'Анкет пока нет — создайте ссылку для пациента'}
        </p>
      );
    }
    return (
      <RegistryList
        items={list.items}
        selectedId={selectedId}
        clinicId={superAdmin ? clinicId : undefined}
      />
    );
  };

  const renderDetail = () => {
    if (!selectedId) {
      return (
        <p className="mt-40 text-center text-[var(--ui-color-alabaster-950)]">
          Выберите анкету в списке
        </p>
      );
    }
    let content: React.ReactNode;
    if (detail.error === 'not_found')
      content = (
        <p className="my-40 text-center text-[var(--ui-color-alabaster-950)]">
          Анкета не найдена
        </p>
      );
    else if (!detail.data && detail.isLoading) content = <Spinner />;
    else if (!detail.data)
      content = (
        <ErrorState
          text="Не удалось загрузить анкету"
          onRetry={detail.reload}
        />
      );
    else {
      content = (
        <RegistryDetail
          key={detail.data.id}
          clinicId={clinicId}
          questionnaire={detail.data}
          onChanged={refreshAll}
          onDeleted={() => {
            select(null);
            list.reload();
          }}
        />
      );
    }
    return (
      <div className="custom-scrollbar max-h-[calc(100dvh-140px)] min-[1200px]:max-h-[calc(100dvh-100px)] min-w-0 w-full max-w-246 self-start overflow-x-hidden overflow-y-auto rounded-2xl bg-white px-4 py-6 2xl:px-8">
        {content}
      </div>
    );
  };

  return (
    <>
      <h1 className="sr-only">Анкеты для стоматологии</h1>

      {/* Колонка — как в разделе «Анкеты» у врача: кнопка, белая карточка
          фильтров, заголовок списка. */}
      <aside
        aria-label="Анкеты для стоматологии"
        className="fixed top-[120px] min-[1200px]:top-20 bottom-5 left-0 ml-3 mr-5 flex min-h-0 w-85.75 flex-col bg-[var(--ui-color-slate-100)]"
      >
        {superAdmin && (
          <label className="mb-3 block text-sm">
            Клиника
            <CustomDropdown
              aria-label="Клиника регистратуры"
              value={clinicId ?? ''}
              options={clinics.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(value) => {
                setIsCreating(false);
                router.replace(
                  '/registry?clinic_id=' + encodeURIComponent(value),
                );
              }}
              className="mt-2"
            />
          </label>
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setIsCreating(true)}
          className="vismuth-button vismuth-button--secondary w-full shrink-0"
        >
          Новая ссылка
        </button>

        <div className="mt-6 shrink-0">
          <QuestionnaireFilters
            search={name}
            onSearchChange={setName}
            date={date}
            onDateChange={setDate}
            dateLabel="Дата заполнения"
            onClearDate={() => setDate('')}
            markedDates={markedDates}
          />
        </div>

        <div className="custom-scrollbar mt-6 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <h2 className="px-0 py-[var(--ui-space-8)] text-[length:var(--ui-font-size-14)] font-medium">
            {date ? formatDateLabel(date) : 'Все даты'}
          </h2>
          {renderList()}
        </div>
      </aside>

      <div className="ml-93.5 flex min-w-0 flex-1 justify-center pr-5">
        {renderDetail()}
      </div>

      {isCreating ? (
        <NewLinkModal
          clinicId={clinicId}
          onClose={() => setIsCreating(false)}
          onCreated={(created) => {
            setDate('');
            setCalendarVersion((version) => version + 1);
            list.reload();
            select(created.id);
          }}
        />
      ) : null}
    </>
  );
};
