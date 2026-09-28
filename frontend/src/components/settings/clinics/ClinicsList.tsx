'use client';

import { useEffect, useState } from 'react';
import { mainApi, type ClinicRead } from '@/api';
import { getClinicStatus, type ClinicStatusTone } from '@/lib/clinics';
import { logWarn } from '@/lib/logger';
import { ErrorState, Spinner } from './fields';

const TONE_CLASS: Record<ClinicStatusTone, string> = {
  muted: 'text-[#6C757D]',
  success: 'text-[#22A06B]',
  danger: 'text-[#E53E3E]',
};

interface ClinicsListProps {
  onOpen: (clinicId: string) => void;
  onCreate: () => void;
}

export const ClinicsList = ({ onOpen, onCreate }: ClinicsListProps) => {
  const [clinics, setClinics] = useState<ClinicRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    mainApi.clinics
      .list()
      .then((data) => {
        if (cancelled) return;
        setClinics(data);
        setError(false);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logWarn('Не удалось загрузить клиники', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-8 pb-6">
        <h3 className="text-3xl font-medium text-[#202020]">Клиники</h3>
        <button
          type="button"
          onClick={onCreate}
          className="h-9.5 cursor-pointer rounded-xl bg-[#5D8CF1] px-5 text-sm text-white transition-colors hover:bg-[#4A7BE0]"
        >
          Создать новую
        </button>
      </div>

      <div className="px-8 py-5">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState text="Не удалось загрузить клиники" onRetry={retry} />
        ) : clinics.length === 0 ? (
          <p className="py-16 text-center text-[#6C757D]">Клиник пока нет</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clinics.map((clinic) => {
              const status = getClinicStatus(
                clinic.access_status_code,
                clinic.access_until,
              );

              return (
                <li key={clinic.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(clinic.id)}
                    className="shadow-custom-hover flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl px-3.75 py-3 text-left transition-all"
                  >
                    <span className="min-w-0 truncate text-base text-[#202020]">
                      {clinic.name}
                    </span>
                    <span
                      className={`shrink-0 text-base ${TONE_CLASS[status.tone]}`}
                    >
                      {status.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};
