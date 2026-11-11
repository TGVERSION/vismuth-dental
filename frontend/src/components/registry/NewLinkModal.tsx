'use client';

import { useRef, useState } from 'react';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { INPUT_CLASS } from '@/components/settings/clinics/fields';
import { copyText } from '@/lib/clipboard';
import { fieldFillClass } from '@/lib/field-fill';
import { toDateInputValue } from '@/lib/questionnaire';
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
  const [copyStatus, setCopyStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const urlRef = useRef<HTMLInputElement>(null);

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
      setCopyStatus('');
    } catch (error) {
      setServerError(createErrorText(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await copyText(url);
      setCopyStatus('Ссылка скопирована');
    } catch {
      urlRef.current?.focus();
      urlRef.current?.select();
      setCopyStatus('Скопируйте выделенную ссылку вручную');
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
      <form
        onSubmit={handleSubmit}
        className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_auto]"
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
        <div className="group relative">
          <input
            type="date"
            className={`${INPUT_CLASS} ${fieldFillClass(birthDate)} ${birthDate ? '' : 'text-transparent! focus:text-[var(--ui-color-alabaster-dark-800)]!'}`}
            aria-label="Дата рождения"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            max={toDateInputValue(new Date())}
            disabled={isSaving}
          />
          {!birthDate && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ui-color-alabaster-800)] group-focus-within:hidden"
            >
              Дата рождения
            </span>
          )}
        </div>
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
          <>
            <input
              ref={urlRef}
              value={url}
              readOnly
              aria-label="Ссылка для пациента"
              onFocus={(event) => event.target.select()}
              className="vismuth-input min-w-0 bg-white! sm:col-span-2"
            />
            <button
              type="button"
              className="vismuth-button vismuth-button--secondary"
              data-size="s"
              onClick={() => void copyLink()}
            >
              {copyStatus === 'Ссылка скопирована'
                ? 'Скопировано'
                : 'Копировать'}
            </button>
            <p
              role="status"
              className={copyStatus ? 'text-sm sm:col-span-3' : 'sr-only'}
            >
              {copyStatus}
            </p>
          </>
        )}
      </form>
    </ModalShell>
  );
};
