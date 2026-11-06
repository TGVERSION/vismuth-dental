'use client';
import { useCallback, useEffect, useState } from 'react';
import { clinicJoinApi, type JoinState } from '@/api/clinic-join-api';
import { joinStatusLabel } from '@/lib/clinic-access';
import { useAuth } from '@/hooks/useAuth';
export function JoinStatus({ onAllowed }: { onAllowed?: () => void }) {
  const [state, setState] = useState<JoinState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { handleLogout } = useAuth();
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const next = await clinicJoinApi.me();
      setState(next);
      setError('');
      if (!next.restricted) onAllowed?.();
    } catch {
      setError('Не удалось проверить статус заявки');
    } finally {
      setBusy(false);
    }
  }, [onAllowed]);
  useEffect(() => {
    void reload();
    const focus = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, [reload]);
  return (
    <section className="mx-auto my-24 w-full max-w-xl space-y-5 rounded-2xl bg-white p-8">
      <h1 className="text-2xl font-medium">Заявка на подключение</h1>
      <p>
        {!state
          ? 'Проверяем состояние заявки…'
          : state.requests.some((r) => r.status === 'pending')
            ? 'Ожидайте подтверждения супер-администратора. Доступ появится после одобрения.'
            : 'Заявка отклонена. При необходимости повторите подачу через действующую ссылку клиники.'}
      </p>
      {state?.requests.map((r) => (
        <article key={r.id} className="rounded-xl bg-[#F3F4F8] p-4">
          <h2 className="font-medium">{r.clinic_name}</h2>
          <p>{joinStatusLabel(r.status)}</p>
        </article>
      ))}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-5">
        <button
          disabled={busy}
          onClick={() => void reload()}
          className="text-[#5D8CF1] disabled:opacity-50"
        >
          {busy ? 'Проверяется…' : 'Обновить статус'}
        </button>
        <button onClick={() => void handleLogout()} className="text-gray-500">
          Выйти
        </button>
      </div>
    </section>
  );
}
