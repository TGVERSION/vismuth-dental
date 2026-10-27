'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RegistryStatus } from '@/api';
import { mainApi } from '@/api';
import { ErrorState, INPUT_CLASS, Spinner } from '@/components/settings/clinics/fields';
import { useMyClinic } from '@/hooks/useMyClinic';
import { useRegistryDetail, useRegistryList } from '@/hooks/useRegistry';
import { canUseRegistry } from '@/lib/app-nav';
import { logWarn } from '@/lib/logger';
import { toDateInputValue } from '@/lib/questionnaire';
import { REGISTRY_STATUS_OPTIONS, doctorOptions, type DoctorOption } from '@/lib/registry';
import { NewLinkModal } from './NewLinkModal';
import { RegistryDetail } from './RegistryDetail';
import { RegistryList } from './RegistryList';

const FIELD = `${INPUT_CLASS} bg-white`;

/** Поиск по ФИО уходит на сервер после паузы в наборе, а не на каждую букву. */
const SEARCH_DEBOUNCE_MS = 300;
/**
 * Регистратура держит список открытым и ждёт, пока пациенты заполнят
 * анкеты: статусы обновляются сами, без перезагрузки страницы.
 */
const REFRESH_MS = 30000;

export interface DoctorsState {
  doctors: DoctorOption[];
  status: 'loading' | 'ready' | 'failed';
}

/** Врачи клиники для формы новой ссылки. */
const useDoctors = (clinicId: string | null): DoctorsState => {
  const [state, setState] = useState<DoctorsState>({ doctors: [], status: 'loading' });
  useEffect(() => {
    if (!clinicId) return;
    let isActive = true;
    mainApi.clinicMembers
      .list(clinicId)
      .then((members) => {
        if (isActive) setState({ doctors: doctorOptions(members), status: 'ready' });
      })
      .catch((error: unknown) => {
        logWarn('Регистратура: врачи не загружены', error);
        if (isActive) setState({ doctors: [], status: 'failed' });
      });
    return () => {
      isActive = false;
    };
  }, [clinicId]);
  return state;
};

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
 * Раздел «Анкеты пациентов» регистратуры: слева фильтры и анкеты за день,
 * справа открытая анкета. Выбранная анкета — в адресе (`?id=`).
 */
export const RegistryScreen = () => {
  const router = useRouter();
  const selectedId = useSearchParams().get('id');
  const { clinic, isLoading: isClinicLoading, error: clinicError } = useMyClinic();
  const clinicId = canUseRegistry(clinic) && clinic ? clinic.clinic_id : null;

  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [status, setStatus] = useState<RegistryStatus | ''>('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const searchName = useDebounced(name.trim(), SEARCH_DEBOUNCE_MS);
  const query = useMemo(
    () => ({
      date,
      ...(status ? { status } : {}),
      ...(searchName ? { name: searchName } : {}),
    }),
    [date, status, searchName],
  );
  const list = useRegistryList(clinicId, query);
  const detail = useRegistryDetail(clinicId, selectedId);
  const doctors = useDoctors(clinicId);
  const { reload: reloadList } = list;
  const { reload: reloadDetail } = detail;
  const refreshAll = useCallback(() => {
    reloadList();
    reloadDetail();
  }, [reloadList, reloadDetail]);
  useAutoRefresh(refreshAll);

  const select = (id: string | null) =>
    router.replace(id ? `/registry?id=${encodeURIComponent(id)}` : '/registry', { scroll: false });

  if (isClinicLoading) return <Spinner />;
  if (clinicError === 'failed') {
    return <ErrorState text="Не удалось загрузить данные клиники" onRetry={() => window.location.reload()} />;
  }
  if (!clinicId) {
    return (
      <p className="mx-auto mt-40 max-w-md text-center text-[#8B8B8B]">
        Раздел доступен администратору клиники со стоматологической анкетой
      </p>
    );
  }

  const renderList = () => {
    if (list.isLoading && list.items.length === 0) return <Spinner />;
    if (list.error && list.items.length === 0) {
      return <ErrorState text="Не удалось загрузить анкеты" onRetry={list.reload} />;
    }
    if (list.items.length === 0) {
      return <p className="px-4 py-8 text-center text-sm text-[#8B8B8B]">На этот день анкет нет</p>;
    }
    return <RegistryList items={list.items} selectedId={selectedId} />;
  };

  const renderDetail = () => {
    if (!selectedId) {
      return <p className="mt-40 text-center text-[#8B8B8B]">Выберите анкету в списке</p>;
    }
    let content: React.ReactNode;
    if (detail.error === 'not_found') content = <p className="my-40 text-center text-[#8B8B8B]">Анкета не найдена</p>;
    else if (!detail.data && detail.isLoading) content = <Spinner />;
    else if (!detail.data) content = <ErrorState text="Не удалось загрузить анкету" onRetry={detail.reload} />;
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
      <div className="custom-scrollbar max-h-[calc(100vh-100px)] w-full max-w-246 self-start overflow-y-auto rounded-[15px] bg-white px-8 py-6">
        {content}
      </div>
    );
  };

  return (
    <>
      <h1 className="sr-only">Анкеты пациентов</h1>

      <aside
        aria-label="Анкеты пациентов за день"
        className="custom-height fixed top-20 left-0 ml-3 mr-5 flex w-85.75 flex-col gap-3 bg-[#F3F4F8]"
      >
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="h-11 rounded-xl bg-[#5D8CF1] text-sm font-medium text-white hover:bg-[#769CEF]"
        >
          Новая ссылка
        </button>
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="День приёма"
            className={FIELD}
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
          />
          <select
            aria-label="Статус"
            className={FIELD}
            value={status}
            onChange={(event) => setStatus(event.target.value as RegistryStatus | '')}
          >
            {REGISTRY_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="search"
          aria-label="Поиск по ФИО"
          placeholder="Поиск по ФИО"
          className={FIELD}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto">{renderList()}</div>
      </aside>

      <div className="ml-93.5 flex min-w-0 flex-1 justify-center pr-5">{renderDetail()}</div>

      {isCreating ? (
        <NewLinkModal
          clinicId={clinicId}
          doctors={doctors.doctors}
          doctorsStatus={doctors.status}
          onClose={() => setIsCreating(false)}
          onCreated={(created) => {
            if (created.appointment_date) setDate(created.appointment_date);
            list.reload();
            select(created.id);
          }}
        />
      ) : null}
    </>
  );
};
