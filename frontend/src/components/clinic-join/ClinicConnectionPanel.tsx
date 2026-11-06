'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clinicJoinApi } from '@/api/clinic-join-api';
import { completedApi, type PatientLinks } from '@/api/completed-api';
export function ClinicConnectionPanel({
  clinicId,
  dental,
}: {
  clinicId: string;
  dental: boolean;
}) {
  const [active, setActive] = useState<boolean | null>(null),
    [url, setUrl] = useState(''),
    [links, setLinks] = useState<PatientLinks | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState('');
  useEffect(() => {
    let live = true;
    Promise.allSettled([
      clinicJoinApi.link(clinicId),
      completedApi.links(clinicId),
    ]).then(([a, b]) => {
      if (!live) return;
      if (a.status === 'fulfilled') setActive(a.value.active);
      if (b.status === 'fulfilled') setLinks(b.value);
      if (a.status === 'rejected' || b.status === 'rejected')
        setError('Не удалось загрузить ссылки');
    });
    return () => {
      live = false;
    };
  }, [clinicId]);
  const act = async (disable = false) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (disable) {
        await clinicJoinApi.disable(clinicId);
        setActive(false);
        setUrl('');
      } else {
        const r = await clinicJoinApi.issue(clinicId);
        setActive(r.active);
        setUrl(r.url);
        setCopied('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить ссылку');
    } finally {
      setBusy(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setError('Не удалось скопировать. Выделите ссылку и скопируйте вручную.');
    }
  };
  const link = (value: string, label: string) => (
    <div className="space-y-1" key={value}>
      <p className="text-sm">{label}</p>
      <div className="flex items-center gap-3">
        <input
          aria-label={label}
          readOnly
          value={value}
          className="min-w-0 flex-1 rounded-lg bg-[#F3F4F8] p-2 text-sm"
        />
        <button
          onClick={() => void copy(value)}
          className="text-sm text-[#5D8CF1]"
        >
          {copied === value ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
    </div>
  );
  return (
    <section className="space-y-5 border-t border-gray-200 px-8 py-8">
      <h3 className="text-xl font-medium">Пациентские ссылки</h3>
      {links?.clinic_public_url &&
        link(links.clinic_public_url, 'Общая ссылка клиники')}
      {links?.doctors.map((d) =>
        link(
          d.public_url,
          [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' '),
        ),
      )}
      {!links?.clinic_public_url && (
        <p className="text-sm text-gray-500">
          Общая анкета для этого направления недоступна
        </p>
      )}
      {dental && (
        <Link
          className="inline-block text-[#5D8CF1]"
          href={'/registry?clinic_id=' + encodeURIComponent(clinicId)}
        >
          Создать персональную стоматологическую ссылку
        </Link>
      )}
      <h3 className="pt-4 text-xl font-medium">Подключение сотрудников</h3>
      <p className="text-sm text-gray-500">
        {active
          ? 'Ссылка действует. Для получения новой копии перевыпустите её. Прежняя ссылка перестанет работать.'
          : 'Создайте общую ссылку. Каждую заявку подтверждает супер-администратор.'}
      </p>
      {url && (
        <>
          {link(url, 'Ссылка для сотрудников')}
          <p className="text-sm text-gray-500">
            Сохраните ссылку сейчас: после закрытия карточки она не
            отображается.
          </p>
        </>
      )}
      <div className="flex gap-5">
        <button
          disabled={busy}
          onClick={() => void act()}
          className="text-[#5D8CF1] disabled:opacity-50"
        >
          {active ? 'Перевыпустить ссылку' : 'Создать ссылку'}
        </button>
        {active && (
          <button
            disabled={busy}
            onClick={() => void act(true)}
            className="text-red-700 disabled:opacity-50"
          >
            Отключить
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
