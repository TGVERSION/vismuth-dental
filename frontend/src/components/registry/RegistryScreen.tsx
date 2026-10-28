'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RegistryStatus } from '@/api';
import { ErrorState, INPUT_CLASS, Spinner } from '@/components/settings/clinics/fields';
import { useMyClinic } from '@/hooks/useMyClinic';
import { useRegistryDetail, useRegistryList } from '@/hooks/useRegistry';
import { canUseRegistry } from '@/lib/app-nav';
import { REGISTRY_STATUS_OPTIONS } from '@/lib/registry';
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
  const selectedId = useSearchParams().get('id');
  const { clinic, isLoading: isClinicLoading, error: clinicError } = useMyClinic();
  const clinicId = canUseRegistry(clinic) && clinic ? clinic.clinic_id : null;

  const [status, setStatus] = useState<RegistryStatus | ''>('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const searchName = useDebounced(name.trim(), SEARCH_DEBOUNCE_MS);
  const query = useMemo(
    () => ({
      ...(status ? { status } : {}),
      ...(searchName ? { name: searchName } : {}),
    }),
    [status, searchName],
  );
  const list = useRegistryList(clinicId, query);
  const detail = useRegistryDetail(clinicId, selectedId);
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
      const isFiltered = Boolean(status || searchName);
      return (
        <p className="px-4 py-8 text-center text-sm text-[#8B8B8B]">
          {isFiltered ? 'Ничего не найдено' : 'Анкет пока нет — создайте ссылку для пациента'}
        </p>
      );
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
          clinicName={clinic?.clinic_name ?? ''}
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
        aria-label="Анкеты пациентов"
        className="custom-height fixed top-20 left-0 ml-3 mr-5 flex w-85.75 flex-col gap-3 bg-[#F3F4F8]"
      >
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="h-11 rounded-xl bg-[#5D8CF1] text-sm font-medium text-white hover:bg-[#769CEF]"
        >
          Новая ссылка
        </button>
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
          onClose={() => setIsCreating(false)}
          onCreated={(created) => {
            list.reload();
            select(created.id);
          }}
        />
      ) : null}
    </>
  );
};
