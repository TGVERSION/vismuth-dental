'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { copyText } from '@/lib/clipboard';
import { clinicJoinApi } from '@/api/clinic-join-api';
import { PatientLinkGenerator } from '@/components/doctor-questionnaires/PatientLinkGenerator';
export function ClinicConnectionPanel({
  clinicId,
  dental,
}: {
  clinicId: string;
  dental: boolean;
}) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [copied, setCopied] = useState('');
  useEffect(() => {
    let live = true;
    Promise.allSettled([clinicJoinApi.link(clinicId)]).then(([a]) => {
      if (!live) return;
      if (a.status === 'fulfilled') setUrl(a.value.url);
      if (a.status === 'rejected') setError('Не удалось загрузить ссылки');
    });
    return () => {
      live = false;
    };
  }, [clinicId, reload]);
  const act = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await clinicJoinApi.issue(clinicId);
      setUrl(r.url);
      setCopied('');
    } catch (e) {
      try {
        const current = await clinicJoinApi.link(clinicId);
        setUrl(current.url);
        setCopied('');
        setError(
          'Ответ на обновление не получен. Показана текущая действующая ссылка.',
        );
      } catch {
        setUrl('');
        setError(
          e instanceof Error
            ? e.message
            : 'Не удалось загрузить действующую ссылку',
        );
      }
    } finally {
      setBusy(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await copyText(value);
      setCopied(value);
    } catch {
      setError('Не удалось скопировать. Выделите ссылку и скопируйте вручную.');
    }
  };
  return (
    <section className="space-y-5 border-t border-gray-200 px-8 py-8">
      <h3 className="text-xl font-medium">Пациентские ссылки</h3>
      <PatientLinkGenerator clinicId={clinicId} />
      {dental && (
        <Link
          className="inline-block text-[var(--ui-color-blue-600)]"
          href={'/registry?clinic_id=' + encodeURIComponent(clinicId)}
        >
          Создать персональную стоматологическую ссылку
        </Link>
      )}
      <h3 className="pt-4 text-xl font-medium">Подключение сотрудников</h3>
      <p className="text-sm text-gray-500">
        Каждую заявку подтверждает супер-администратор. После обновления прежние
        ссылки перестанут работать.
      </p>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Ссылка для сотрудников"
            readOnly
            value={url}
            placeholder="Загрузка ссылки…"
            onFocus={(e) => e.target.select()}
            className="vismuth-input min-w-0 flex-1"
          />
          <button
            disabled={busy || !url}
            onClick={() => void copy(url)}
            className="vismuth-function-button text-sm"
          >
            {copied === url && url ? 'Скопировано' : 'Копировать'}
          </button>
          <button
            disabled={busy || !url}
            onClick={() => void act()}
            className="vismuth-function-button text-sm"
          >
            {busy ? 'Обновляется…' : 'Обновить'}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError('');
              setReload((value) => value + 1);
            }}
            className="vismuth-function-button block"
          >
            Повторить загрузку
          </button>
        </div>
      )}
    </section>
  );
}
