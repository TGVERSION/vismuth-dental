'use client';
import { useCallback, useEffect, useState } from 'react';
import { mainApi, type ClinicRead } from '@/api';
import {
  completedApi,
  type CompletedItem,
  type CompletedDetail as Detail,
} from '@/api/completed-api';
import { completedQuery, type CompletedFilters } from '@/lib/clinic-access';
import { useAuthStore } from '@/store/authStore';
import { useMyClinic } from '@/hooks/useMyClinic';
import { CompletedDetail } from './CompletedDetail';
import {
  formatAppointmentTime,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { CustomDropdown } from '@/components/CustomDropdown';
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
      date: '',
    }),
    [page, setPage] = useState(1),
    [items, setItems] = useState<CompletedItem[]>([]),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState(''),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (superAdmin)
      mainApi.clinics
        .list()
        .then(setClinics)
        .catch(() => setError('Не удалось загрузить клиники'));
  }, [superAdmin]);
  useEffect(() => {
    if (!scope) return;
    let live = true;
    completedApi
      .list(scope, completedQuery(filters, page))
      .then((r) => {
        if (live) {
          setItems(r.items);
          setTotal(r.total);
          setError('');
        }
      })
      .catch(() => {
        if (live) {
          setItems([]);
          setTotal(0);
          setError('Не удалось загрузить заполненные анкеты');
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [scope, filters, page, refresh]);
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
    setLoading(true);
    setItems([]);
    setTotal(0);
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
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
        className="custom-scrollbar mx-3 flex shrink-0 flex-col bg-[#F3F4F8] lg:fixed lg:top-20 lg:left-0 lg:mx-0 lg:ml-3 lg:h-[calc(100vh-100px)] lg:w-85.75 lg:overflow-y-auto"
      >
        <h1 className="sr-only">
          {superAdmin ? 'Анкеты для врачей' : 'Заполненные анкеты'}
        </h1>
        <div className="flex shrink-0 flex-col gap-3 rounded-[15px] bg-white p-3">
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
          <input
            aria-label="ФИО пациента"
            placeholder="ФИО пациента"
            className="vismuth-input"
            value={filters.name}
            onChange={(e) => filter('name', e.target.value)}
          />
          <label className="text-sm">
            Дата заполнения
            <input
              type="date"
              className="vismuth-input mt-1"
              value={filters.date}
              onChange={(e) => filter('date', e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mb-4 text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-1 flex-col">
          <p role="status" className="mb-3 text-sm text-gray-500">
            {loading ? 'Загрузка…' : 'Найдено: ' + total}
          </p>
          <div className="space-y-2">
            {items.map((i) => (
              <button
                key={i.id}
                disabled={loading}
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
          <div className="mt-5 flex items-center gap-5">
            <button
              disabled={page === 1 || loading}
              onClick={() => {
                setLoading(true);
                setSelected('');
                setDetail(null);
                setItems([]);
                setPage((p) => p - 1);
              }}
              className="text-[var(--ui-color-blue-600)] disabled:opacity-40"
            >
              Назад
            </button>
            <span>
              Страница {page} из {Math.max(1, Math.ceil(total / 25))}
            </span>
            <button
              disabled={page * 25 >= total || loading}
              onClick={() => {
                setLoading(true);
                setSelected('');
                setDetail(null);
                setItems([]);
                setPage((p) => p + 1);
              }}
              className="text-[var(--ui-color-blue-600)] disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
          {!superAdmin && (clinic?.is_operator || clinic?.is_clinic_admin) && (
            <OperatorLinks clinicId={clinic.clinic_id} />
          )}
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
    </section>
  );
}
function OperatorLinks({ clinicId }: { clinicId: string }) {
  const [links, setLinks] = useState<Awaited<
      ReturnType<typeof completedApi.links>
    > | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    completedApi
      .links(clinicId)
      .then(setLinks)
      .catch(() => setError('Не удалось загрузить пациентские ссылки'));
  }, [clinicId]);
  return (
    <section className="mt-6 space-y-3 rounded-xl bg-white p-5">
      <h2 className="font-medium">Ссылки для пациентов</h2>
      {error && <p role="alert">{error}</p>}
      {[
        ...(links?.clinic_public_url
          ? [{ url: links.clinic_public_url, label: 'Общая ссылка клиники' }]
          : []),
        ...(links?.doctors ?? []).map((d) => ({
          url: d.public_url,
          label: [d.last_name, d.first_name].filter(Boolean).join(' '),
        })),
      ].map((l) => (
        <label key={l.url} className="block text-sm">
          {l.label}
          <input
            readOnly
            value={l.url}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded-lg bg-[var(--ui-color-slate-100)] p-2"
          />
        </label>
      ))}
    </section>
  );
}
