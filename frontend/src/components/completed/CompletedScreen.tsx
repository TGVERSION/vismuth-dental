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
      date_from: '',
      date_to: '',
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
    <section className="custom-scrollbar max-h-[calc(100vh-80px)] w-full overflow-auto p-6">
      <h1 className="mb-5 text-2xl font-medium">Заполненные анкеты</h1>
      <div className="mb-5 flex flex-wrap gap-3">
        {superAdmin && (
          <CustomDropdown
            aria-label="Клиника"
            className="max-w-sm"
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
          className="max-w-64"
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
          Заполнена с
          <input
            type="date"
            className="vismuth-input ml-2"
            value={filters.date_from}
            onChange={(e) => filter('date_from', e.target.value)}
          />
        </label>
        <label className="text-sm">
          по
          <input
            type="date"
            className="vismuth-input ml-2"
            value={filters.date_to}
            min={filters.date_from}
            onChange={(e) => filter('date_to', e.target.value)}
          />
        </label>
        <button onClick={changed} className="vismuth-function-button">
          Обновить
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
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
                className={
                  'block w-full rounded-xl border bg-white p-4 text-left ' +
                  (selected === i.id
                    ? 'border-[var(--ui-color-blue-600)]'
                    : 'border-transparent')
                }
              >
                <p className="font-medium">
                  {[
                    i.patient_last_name,
                    i.patient_first_name,
                    i.patient_middle_name,
                  ]
                    .filter(Boolean)
                    .join(' ') || 'Пациент'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {i.clinic_name} · {kinds[i.kind]}
                </p>
                <p className="text-sm text-gray-500">
                  {i.completed_at
                    ? new Date(i.completed_at).toLocaleString('ru-RU')
                    : ''}
                </p>
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
        <div className="rounded-2xl bg-white p-6">
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
