'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  completedApi,
  type PatientLinks,
  type PatientLinkRequest,
} from '@/api/completed-api';
import { isAbortError } from '@/api/base-client';
import { CustomDropdown } from '@/components/CustomDropdown';
import { DateField } from '@/components/DateField';
import { copyText } from '@/lib/clipboard';
import { APPOINTMENT_DAYS_AHEAD, toDateInputValue } from '@/lib/questionnaire';
import { normalizeQrUrl } from '@/lib/qr';
import type { QuestionnaireLinkItem } from '@/lib/questionnaire-links';
import { LinkQrCard } from './LinkQrCard';

interface Props {
  clinicId: string;
  onPrint?: (item: QuestionnaireLinkItem) => void;
}

/** Все параметры необязательны; адрес и его уникальность определяет сервер. */
export function PatientLinkGenerator({ clinicId, onPrint }: Props) {
  return (
    <ClinicPatientLinkGenerator
      key={clinicId}
      clinicId={clinicId}
      onPrint={onPrint}
    />
  );
}

function ClinicPatientLinkGenerator({ clinicId, onPrint }: Props) {
  const [links, setLinks] = useState<PatientLinks | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const dateId = useId();
  const timeId = useId();
  const today = toDateInputValue(new Date());
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + APPOINTMENT_DAYS_AHEAD);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    completedApi
      .links(clinicId)
      .then((data) => {
        if (live) {
          setLinks(data);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (live && !isAbortError(cause)) {
          setError('Не удалось загрузить врачей и ссылку клиники');
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [clinicId, reload]);

  const update = (set: (value: string) => void, value: string) => {
    set(value);
    setUrl('');
    setError('');
  };

  const create = async () => {
    if (inFlight.current || !links?.clinic_public_url) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const body: PatientLinkRequest = {
      ...(doctorId ? { doctor_membership_id: doctorId } : {}),
      ...(date ? { appointment_date: date } : {}),
      ...(time ? { appointment_time: time } : {}),
    };
    try {
      const result = await completedApi.createLink(clinicId, body);
      if (mounted.current) setUrl(result.url);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : 'Не удалось создать ссылку',
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const copyClinic = async () => {
    if (!links?.clinic_public_url) return;
    try {
      await copyText(links.clinic_public_url);
      setCopied(true);
    } catch {
      setError(
        'Не удалось скопировать ссылку. Выделите её и скопируйте вручную.',
      );
    }
  };

  if (loading)
    return (
      <p role="status" className="py-5 text-sm text-gray-500">
        Загрузка врачей…
      </p>
    );
  if (!links)
    return (
      <div className="space-y-3">
        <p role="alert">{error}</p>
        <button
          className="vismuth-function-button"
          onClick={() => {
            setLoading(true);
            setError('');
            setReload((value) => value + 1);
          }}
        >
          Повторить
        </button>
      </div>
    );
  if (!links.clinic_public_url)
    return (
      <p className="text-sm text-gray-500">
        Общая анкета для этого направления недоступна
      </p>
    );

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Врач, дата и время приёма — по желанию. Указанные дату и время пациенту
        повторно вводить не придётся.
      </p>
      <label className="block space-y-2">
        <span className="text-sm">Врач</span>
        <CustomDropdown
          options={[
            { value: '', label: 'Пациент выберет врача' },
            ...links.doctors.map((doctor) => ({
              value: doctor.membership_id,
              label:
                [doctor.last_name, doctor.first_name, doctor.middle_name]
                  .filter(Boolean)
                  .join(' ') || 'Врач',
            })),
          ]}
          value={doctorId}
          onChange={(value) => update(setDoctorId, value)}
          disabled={busy}
          aria-label="Врач для ссылки"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={dateId} className="text-sm">
            Дата приёма
          </label>
          <DateField
            id={dateId}
            value={date}
            onChange={(value) => {
              if (!busy) update(setDate, value);
            }}
            min={today}
            max={toDateInputValue(horizon)}
            placeholder="Не указана"
            popoverAlign="left"
            aria-label="Дата приёма для ссылки"
          />
          {date && (
            <button
              type="button"
              disabled={busy}
              onClick={() => update(setDate, '')}
              className="vismuth-function-button text-sm"
            >
              Убрать дату
            </button>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor={timeId} className="text-sm">
            Время приёма
          </label>
          <input
            id={timeId}
            type="time"
            aria-label="Время приёма для ссылки"
            value={time}
            onChange={(event) => update(setTime, event.target.value)}
            disabled={busy}
            className="vismuth-input w-full"
          />
          {time && (
            <button
              type="button"
              disabled={busy}
              onClick={() => update(setTime, '')}
              className="vismuth-function-button text-sm"
            >
              Убрать время
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        className="vismuth-button vismuth-button--secondary w-full"
      >
        {busy ? 'Создаётся…' : 'Создать ссылку'}
      </button>
      <div className="space-y-2">
        <p className="text-sm text-gray-500">Общая ссылка клиники</p>
        <div className="flex min-w-0 items-center gap-3">
          <input
            aria-label="Общая ссылка клиники"
            readOnly
            value={links.clinic_public_url}
            onFocus={(event) => event.target.select()}
            className="vismuth-input min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => void copyClinic()}
            className="vismuth-function-button text-sm"
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {url && (
        <LinkQrCard
          key={url}
          item={{
            kind: 'invite',
            title: 'Ссылка для пациента',
            description: 'Отправьте пациенту ссылку или QR-код',
            url,
            qrText: normalizeQrUrl(url),
            fileName: 'vismuth-qr-patient.png',
          }}
          onPrint={onPrint}
        />
      )}
    </div>
  );
}
