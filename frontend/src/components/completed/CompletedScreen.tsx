'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mainApi, type ClinicRead } from '@/api';
import {
  completedApi,
  type CompletedDetail as Detail,
} from '@/api/completed-api';
import { type CompletedFilters } from '@/lib/clinic-access';
import { useAuthStore } from '@/store/authStore';
import { useMyClinic } from '@/hooks/useMyClinic';
import { CompletedDetail } from './CompletedDetail';
import {
  formatAppointmentTime,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { DateField } from '@/components/DateField';
import { formatDateLabel, formatDateNumeric } from '@/lib/calendar';
import { doctorDateRange } from '@/lib/doctor-questionnaires';
import { toDateInputValue } from '@/lib/questionnaire';
import { useQuestionnaireDates } from '@/hooks/useQuestionnaireDates';
import { useCompletedQuestionnaireList } from '@/hooks/useCompletedQuestionnaireList';
import { PatientLinkGenerator } from '@/components/doctor-questionnaires/PatientLinkGenerator';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { CustomDropdown } from '@/components/CustomDropdown';
import { copyText } from '@/lib/clipboard';
const kinds: Record<string, string> = {
  general: 'Общая',
  gastro: 'Гастроэнтерология',
  dental: 'Стоматология',
};
export function CompletedScreen() {
  const superAdmin = useAuthStore((s) => s.user?.role) === 'super_admin';
  const { clinic } = useMyClinic();
  const scope = superAdmin
    ? '/super-admin/questionnaires'
    : clinic?.is_operator || clinic?.is_clinic_admin
      ? '/clinics/' + clinic.clinic_id + '/completed-questionnaires'
      : null;
  const [clinics, setClinics] = useState<ClinicRead[]>([]),
    [filters, setFilters] = useState<CompletedFilters>({
      clinic_id: '',
      kind: '',
      name: '',
      date: toDateInputValue(new Date()),
    }),
    [selected, setSelected] = useState(''),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (superAdmin)
      mainApi.clinics
        .list()
        .then(setClinics)
        .catch(() => setError('Не удалось загрузить клиники'));
  }, [superAdmin]);
  const markedDates = useQuestionnaireDates(
    scope,
    Object.fromEntries(
      Object.entries({
        clinic_id: filters.clinic_id,
        kind: filters.kind,
        name: filters.name.trim(),
      }).filter(([, value]) => value),
    ),
  );
  const list = useCompletedQuestionnaireList(scope, filters, refresh);
  const { items, loading, hasMore, error: listError, loadMore } = list;
  const sentinel = useRef<HTMLDivElement>(null);
  const [showLink, setShowLink] = useState(false);
  const linkClinicId = superAdmin ? filters.clinic_id : clinic?.clinic_id;
  const [clinicLink, setClinicLink] = useState<{
    clinicId: string;
    url: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState('');
  useEffect(() => {
    if (!linkClinicId) return;
    let live = true;
    completedApi
      .links(linkClinicId)
      .then((links) => {
        if (live)
          setClinicLink({
            clinicId: linkClinicId,
            url: links.clinic_public_url ?? '',
          });
      })
      .catch(() => {
        if (live) setError('Не удалось загрузить ссылку клиники');
      });
    return () => {
      live = false;
    };
  }, [linkClinicId]);
  const clinicUrl =
    clinicLink && clinicLink.clinicId === linkClinicId ? clinicLink.url : '';
  const copyClinicLink = async () => {
    try {
      await copyText(clinicUrl);
      setLinkCopied(clinicUrl);
    } catch {
      setError(
        'Не удалось скопировать ссылку. Выделите адрес и скопируйте вручную.',
      );
    }
  };
  const dateRange = doctorDateRange();
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || loading || listError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '150px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, listError, loadMore]);
  useEffect(() => {
    if (!scope || !selected) return;
    let live = true;
    completedApi
      .detail(scope, selected)
      .then((d) => {
        if (live) setDetail(d);
      })
      .catch(() => {
        if (live) setError('Не удалось открыть анкету');
      });
    return () => {
      live = false;
    };
  }, [scope, selected, refresh]);
  const changed = useCallback(() => setRefresh((v) => v + 1), []);
  const filter = (key: keyof CompletedFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setSelected('');
    setDetail(null);
  };
  if (!superAdmin && !clinic?.is_operator && !clinic?.is_clinic_admin)
    return (
      <p className="p-8">
        Раздел доступен оператору клиники и супер-администратору
      </p>
    );
  return (
    <section className="custom-scrollbar flex max-h-[calc(100vh-80px)] w-full flex-col gap-5 overflow-y-auto lg:max-h-none lg:flex-row lg:gap-0 lg:overflow-visible">
      <aside
        aria-label={superAdmin ? 'Анкеты для врачей' : 'Заполненные анкеты'}
        className="mx-3 flex shrink-0 flex-col bg-[#F3F4F8] lg:fixed lg:top-20 lg:left-0 lg:mx-0 lg:ml-3 lg:h-[calc(100vh-100px)] lg:w-85.75"
      >
        <h1 className="sr-only">
          {superAdmin ? 'Анкеты для врачей' : 'Заполненные анкеты'}
        </h1>
        <button
          type="button"
          disabled={!linkClinicId}
          onClick={() => setShowLink(true)}
          className="vismuth-button vismuth-button--secondary w-full shrink-0"
        >
          Создать ссылку для пациента
        </button>
        {clinicUrl && (
          <div className="mt-2 flex items-center gap-2">
            <input
              aria-label="Общая ссылка клиники"
              readOnly
              value={clinicUrl}
              onFocus={(event) => event.target.select()}
              className="vismuth-input min-w-0 flex-1 text-sm"
            />
            <button
              type="button"
              className="vismuth-function-button text-sm"
              onClick={() => void copyClinicLink()}
            >
              {linkCopied === clinicUrl ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        )}
        {superAdmin && !linkClinicId && (
          <p className="mt-2 text-sm text-[#8B8B8B]">
            Выберите клинику для создания ссылки
          </p>
        )}
        <div className="mt-6 flex shrink-0 flex-col gap-3 rounded-[15px] bg-white p-3">
          {superAdmin && (
            <CustomDropdown
              aria-label="Клиника"
              className="w-full"
              options={[
                { value: '', label: 'Все клиники' },
                ...clinics.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={filters.clinic_id}
              onChange={(value) => filter('clinic_id', value)}
            />
          )}
          {!superAdmin && (
            <CustomDropdown
              aria-label="Вид анкеты"
              className="w-full"
              options={[
                { value: '', label: 'Все виды' },
                ...Object.entries(kinds).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              value={filters.kind}
              onChange={(value) => filter('kind', value)}
            />
          )}
          <input
            aria-label="Имя пациента"
            placeholder="Имя пациента"
            className="vismuth-input"
            value={filters.name}
            onChange={(e) => filter('name', e.target.value)}
          />
          <DateField
            markedDates={markedDates}
            value={filters.date}
            onChange={(value) => filter('date', value)}
            min={dateRange.min}
            max={dateRange.max}
            formatValue={formatDateNumeric}
            popoverAlign="left"
            aria-label="Дата приёма"
          />
        </div>
        {error && (
          <p role="alert" className="mb-4 text-red-700">
            {error}
          </p>
        )}
        <div
          data-questionnaire-list-scroll
          className="custom-scrollbar mt-6 flex min-h-0 flex-1 flex-col lg:overflow-x-hidden lg:overflow-y-auto"
        >
          <h2 className="py-2.25 text-[14px] font-medium">
            {formatDateLabel(filters.date)}
          </h2>
          <div className="space-y-2">
            {items.map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  setSelected(i.id);
                  setDetail(null);
                }}
                aria-pressed={selected === i.id}
                className={
                  'flex w-full items-center gap-3 rounded-[15px] px-3 py-2.5 text-left text-[#202020] transition-colors ' +
                  (selected === i.id ? 'bg-white' : 'hover:bg-white')
                }
              >
                <span className="w-15 shrink-0 text-[22px]">
                  {formatAppointmentTime(i.appointment_time)}
                </span>
                <span className="min-w-0 text-[14px]">
                  <span className="block truncate">
                    <strong>{i.code}</strong>
                    {i.code && ' · '}
                    {patientName(i) || 'Пациент'}
                  </span>
                  <span className="block truncate text-[#8B8B8B]">
                    {i.clinic_name} ·{' '}
                    {visitTypeLabel(i.visit_type) || kinds[i.kind]}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {!items.length && !loading && (
            <p className="py-10 text-gray-500">
              По выбранным фильтрам анкет нет
            </p>
          )}
          {loading && (
            <p
              role="status"
              className="py-4 text-center text-sm text-[#8B8B8B]"
            >
              Загрузка…
            </p>
          )}
          {list.error && (
            <div role="alert" className="py-4 text-sm text-red-600">
              Не удалось загрузить анкеты.{' '}
              <button
                type="button"
                onClick={list.retry}
                className="vismuth-function-button"
              >
                Повторить
              </button>
            </div>
          )}
          <div ref={sentinel} aria-hidden="true" className="h-px shrink-0" />
        </div>
      </aside>
      <div className="mx-3 flex min-w-0 flex-1 justify-center lg:mx-0 lg:ml-93.5 lg:pr-5">
        <div className="custom-scrollbar w-full max-w-246 self-start rounded-[15px] bg-white px-4 py-6 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:px-8">
          {detail ? (
            <CompletedDetail
              key={detail.id}
              data={detail}
              onChanged={changed}
            />
          ) : (
            <p className="p-12 text-center text-gray-500">
              {selected ? 'Загрузка анкеты…' : 'Выберите анкету'}
            </p>
          )}
        </div>
      </div>
      {showLink && linkClinicId && (
        <ModalShell
          title="Ссылка для пациента"
          onClose={() => setShowLink(false)}
        >
          <PatientLinkGenerator clinicId={linkClinicId} />
        </ModalShell>
      )}
    </section>
  );
}
