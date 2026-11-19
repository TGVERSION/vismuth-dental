'use client';

import { useEffect, useRef, useState } from 'react';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { completedApi } from '@/api/completed-api';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { DateField } from '@/components/DateField';
import { INPUT_CLASS } from '@/components/settings/clinics/fields';
import { PatientLinkResult } from '@/components/doctor-questionnaires/PatientLinkResult';
import { LinkQrCard } from '@/components/doctor-questionnaires/LinkQrCard';
import { QrPrintSheet } from '@/components/doctor-questionnaires/QrPrintSheet';
import { useQuestionnaireQrPrint } from '@/hooks/useQuestionnaireQrPrint';
import { fieldFillClass } from '@/lib/field-fill';
import { toDateInputValue } from '@/lib/questionnaire';
import { normalizeQrUrl } from '@/lib/qr';
import { buildNewLinkPayload } from '@/lib/registry';

const HAS_CYRILLIC = /[а-яё]/i;

const createErrorText = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 503)
      return 'Доступ клиники к сервису закончился — новые ссылки создать нельзя';
    if (error.status === 409)
      return 'Клиника работает с общей анкетой — персональные ссылки недоступны';
    if (error.status === 400 || error.status === 422)
      return HAS_CYRILLIC.test(error.message)
        ? error.message
        : 'Проверьте поля формы';
  }
  return 'Не удалось создать ссылку. Попробуйте ещё раз.';
};

interface NewLinkModalProps {
  clinicId: string;
  onClose: () => void;
}

export const NewLinkModal = ({ clinicId, onClose }: NewLinkModalProps) => {
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [nameError, setNameError] = useState('');
  const [serverError, setServerError] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [clinicUrl, setClinicUrl] = useState<string | null>(null);
  const [clinicLinkError, setClinicLinkError] = useState(false);
  const [clinicLinkRetry, setClinicLinkRetry] = useState(0);
  const { print, printText } = useQuestionnaireQrPrint();
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    completedApi.links(clinicId).then(
      (links) => {
        if (active) setClinicUrl(links.dental_public_url);
      },
      () => {
        if (active) setClinicLinkError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [clinicId, clinicLinkRetry]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;

    const payload = buildNewLinkPayload(fullName, birthDate);
    setNameError(payload ? '' : 'Укажите фамилию и имя');
    setServerError('');
    if (!payload) return;

    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = await mainApi.clinicQuestionnaires.create(
        clinicId,
        payload,
      );
      setUrl(result.url);
      setFullName('');
      setBirthDate('');
    } catch (error) {
      setServerError(createErrorText(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      title="Создание ссылки пациенту"
      layout="wide-top"
      onClose={onClose}
      closeDisabled={isSaving}
      dismissDisabled={Boolean(url)}
    >
      <div className="custom-scrollbar -mx-2 max-h-[70dvh] overflow-y-auto px-2">
        <form
          onSubmit={handleSubmit}
          className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_8rem]"
        >
          <div className="min-w-0">
            <input
              className={`${INPUT_CLASS} ${fieldFillClass(fullName)}`}
              aria-label="ФИО пациента"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'new-link-name-error' : undefined}
              placeholder="ФИО пациента"
              autoComplete="off"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setNameError('');
              }}
              maxLength={767}
              disabled={isSaving}
              autoFocus
            />
            {nameError && (
              <p
                id="new-link-name-error"
                role="alert"
                className="mt-1 text-xs text-[var(--ui-color-red-600)]"
              >
                {nameError}
              </p>
            )}
          </div>
          <DateField
            birthDate={{ autoComplete: 'off' }}
            aria-label="Дата рождения"
            placeholder="Дата рождения"
            value={birthDate}
            onChange={setBirthDate}
            max={toDateInputValue(new Date())}
            disabled={isSaving}
          />
          <button
            type="submit"
            className="vismuth-button whitespace-nowrap"
            data-size="s"
            disabled={isSaving}
          >
            {isSaving ? 'Создаём…' : 'Создать ссылку'}
          </button>
          {serverError && (
            <p
              role="alert"
              className="text-sm text-[var(--ui-color-red-600)] sm:col-span-3"
            >
              {serverError}
            </p>
          )}
          {url && (
            <div className="min-w-0 sm:col-span-3">
              <PatientLinkResult key={url} url={url} />
            </div>
          )}
        </form>
        {clinicUrl && (
          <div className="mt-6">
            <LinkQrCard
              item={{
                kind: 'clinic',
                title: 'Общая ссылка на стоматологию',
                description: 'Бессрочная ссылка',
                url: clinicUrl,
                qrText: normalizeQrUrl(clinicUrl),
                fileName: 'vismuth-qr-dental.png',
              }}
              onPrint={print}
            />
          </div>
        )}
        {clinicLinkError && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p role="alert">
              Не удалось загрузить общую ссылку на стоматологию
            </p>
            <button
              type="button"
              className="vismuth-function-button"
              onClick={() => {
                setClinicLinkError(false);
                setClinicLinkRetry((value) => value + 1);
              }}
            >
              Повторить
            </button>
          </div>
        )}
      </div>
      {printText ? <QrPrintSheet text={printText} /> : null}
    </ModalShell>
  );
};
