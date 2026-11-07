'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mainApi, type ClinicRead } from '@/api';
import { useAuthStore } from '@/store/authStore';
import type { RegistryStatus } from '@/api';
import { CustomDropdown } from '@/components/CustomDropdown';
import { ErrorState, Spinner } from '@/components/settings/clinics/fields';
import { useMyClinic } from '@/hooks/useMyClinic';
import { useRegistryDetail, useRegistryList } from '@/hooks/useRegistry';
import { canUseRegistry } from '@/lib/app-nav';
import { fieldFillClass } from '@/lib/field-fill';
import { REGISTRY_STATUS_OPTIONS } from '@/lib/registry';
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
      const isFiltered = Boolean(status || searchName);
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
      <div className="custom-scrollbar max-h-[calc(100vh-100px)] w-full max-w-246 self-start overflow-y-auto rounded-2xl bg-white px-8 py-6">
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
        className="custom-height fixed top-20 left-0 ml-3 mr-5 flex w-85.75 flex-col bg-[var(--ui-color-slate-100)]"
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

        <div className="mt-6 flex shrink-0 flex-col gap-3 rounded-2xl bg-white p-3">
          <label className="relative block">
            <span className="sr-only">Фамилия или имя пациента</span>
            <Image
              src="/search.svg"
              alt=""
              width={18}
              height={18}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="search"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Фамилия или имя пациента"
              autoComplete="off"
              maxLength={100}
              className={`h-10 w-full rounded-xl ${fieldFillClass(name)} pr-3 pl-10 text-sm text-[var(--ui-color-alabaster-dark-800)] placeholder:text-[var(--ui-color-alabaster-800)] focus:ring-2 focus:ring-[var(--ui-color-blue-600)] focus:outline-none`}
            />
          </label>
          <CustomDropdown<RegistryStatus | ''>
            options={REGISTRY_STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            placeholder="Статус"
            aria-label="Статус"
            triggerClassName={fieldFillClass(status)}
            // «Все статусы» выбраны при пустом значении — в поле заглушка.
            renderTrigger={(option) => {
              const selected = Array.isArray(option) ? option[0] : option;
              return selected?.value ? (
                <span className="truncate text-sm text-[var(--ui-color-alabaster-dark-800)]">
                  {selected.label}
                </span>
              ) : (
                <span className="truncate text-sm text-[var(--ui-color-alabaster-800)]">
                  Статус
                </span>
              );
            }}
          />
        </div>

        <div className="custom-scrollbar mt-6 flex-1 overflow-x-hidden overflow-y-auto">
          <h2 className="px-0 py-[var(--ui-space-8)] text-[length:var(--ui-font-size-14)] font-medium">
            Анкеты для стоматологии
          </h2>
          {renderList()}
        </div>
      </aside>

      <div className="ml-[var(--ui-space-64)] flex min-w-0 flex-1 justify-center pr-5">
        {renderDetail()}
      </div>

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
