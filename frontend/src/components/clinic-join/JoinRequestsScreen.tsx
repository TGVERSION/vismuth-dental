'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mainApi, type ClinicRead } from '@/api';
import { clinicJoinApi, type JoinRequest } from '@/api/clinic-join-api';
import { joinStatusLabel } from '@/lib/clinic-access';
import { useAuthStore } from '@/store/authStore';
export function JoinRequestsScreen() {
  const superAdmin = useAuthStore((s) => s.user?.role) === 'super_admin';
  const [clinics, setClinics] = useState<ClinicRead[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [clinic, setClinic] = useState(''),
    [status, setStatus] = useState('pending'),
    [items, setItems] = useState<JoinRequest[]>([]),
    [count, setCount] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [specs, setSpecs] = useState<Record<number, string>>({});
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const requestGeneration = ++generation.current;
    if (!superAdmin) return;
    try {
      const [r, p] = await Promise.all([
        clinicJoinApi.requests({
          clinic_id: clinic || undefined,
          status: status || undefined,
          page,
          page_size: 50,
        }),
        clinicJoinApi.requests({ status: 'pending' }),
      ]);
      if (requestGeneration !== generation.current) return;
      setItems(r.items);
      setTotal(r.total);
      setCount(p.total);
      setError('');
    } catch {
      if (requestGeneration !== generation.current) return;
      setError('Не удалось загрузить заявки');
    }
  }, [clinic, status, superAdmin, page]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!superAdmin) return;
    mainApi.clinics
      .list()
      .then(setClinics)
      .catch(() =>
        setError('Не удалось загрузить справочник клиник или специализаций'),
      );
    mainApi.specializations
      .list()
      .then((v) => setSpecs(Object.fromEntries(v.map((s) => [s.id, s.name]))))
      .catch(() => setError('Не удалось загрузить специализации'));
    const focus = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, [superAdmin, reload]);
  const decide = async (id: string, d: 'approve' | 'reject') => {
    if (busy) return;
    setBusy(id);
    try {
      await clinicJoinApi.decide(id, d);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Решение не сохранено');
    } finally {
      setBusy('');
    }
  };
  if (!superAdmin)
    return <p className="p-8">Раздел доступен только супер-администратору</p>;
  return (
    <section className="custom-scrollbar w-full overflow-auto p-8">
      <h1 className="mb-6 text-2xl font-medium">
        Заявки на подключение{' '}
        <span className="text-[#5D8CF1]">{count} ожидают</span>
      </h1>
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          aria-label="Клиника"
          className="rounded-xl bg-white p-3"
          value={clinic}
          onChange={(e) => {
            setClinic(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все клиники</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Статус заявки"
          className="rounded-xl bg-white p-3"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {['pending', 'approved', 'rejected'].map((s) => (
            <option key={s} value={s}>
              {joinStatusLabel(s)}
            </option>
          ))}
        </select>
        <button onClick={() => void reload()} className="text-[#5D8CF1]">
          Обновить
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {items.map((r) => (
          <article
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5"
          >
            <div className="space-y-1">
              <h2 className="font-medium">
                {[r.last_name, r.first_name, r.middle_name]
                  .filter(Boolean)
                  .join(' ') || r.email}
              </h2>
              <p>
                {r.clinic_name} · {r.email}
              </p>
              <p className="text-sm text-gray-500">
                {r.requested_role === 'doctor'
                  ? 'Врач'
                  : 'Оператор контакт-центра'}
                {r.specialization_ids.length
                  ? ' · ' +
                    r.specialization_ids.map((id) => specs[id] ?? id).join(', ')
                  : ''}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(r.created_at).toLocaleString('ru-RU')} ·{' '}
                {joinStatusLabel(r.status)}
              </p>
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-5">
                <button
                  disabled={!!busy}
                  onClick={() => void decide(r.id, 'approve')}
                  className="text-[#5D8CF1] disabled:opacity-50"
                >
                  Подтвердить
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => void decide(r.id, 'reject')}
                  className="text-red-700 disabled:opacity-50"
                >
                  Отклонить
                </button>
              </div>
            )}
          </article>
        ))}
        {!items.length && (
          <p className="py-10 text-gray-500">Заявок по этим фильтрам нет</p>
        )}
      </div>
      {total > 50 && (
        <div className="mt-5 flex gap-5">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-[#5D8CF1] disabled:opacity-40"
          >
            Назад
          </button>
          <span>
            Страница {page} из {Math.ceil(total / 50)}
          </span>
          <button
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="text-[#5D8CF1] disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}
    </section>
  );
}
