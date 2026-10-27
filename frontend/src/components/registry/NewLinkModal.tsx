'use client';

import { useEffect, useRef, useState } from 'react';
import type { RegistryQuestionnaireCreated } from '@/api';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { FieldRow, INPUT_CLASS, LINK_BUTTON_CLASS } from '@/components/settings/clinics/fields';
import { LinkQrCard } from '@/components/doctor-questionnaires/LinkQrCard';
import { logWarn } from '@/lib/logger';
import { toDateInputValue } from '@/lib/questionnaire';
import {
  EMPTY_NEW_LINK,
  buildNewLinkPayload,
  inviteLinkItem,
  validateNewLink,
  type DoctorOption,
  type NewLinkErrors,
  type NewLinkForm,
} from '@/lib/registry';

const FIELD = `${INPUT_CLASS} bg-[#F3F4F8]`;

const HAS_CYRILLIC = /[а-яё]/i;

/** Текст ошибки для регистратуры — только по-русски. */
const createErrorText = (error: unknown): string => {
  if (!(error instanceof ApiError)) return 'Не удалось создать ссылку. Проверьте интернет и попробуйте ещё раз.';
  if (error.status === 503) return 'Доступ клиники к сервису закончился — новые ссылки создать нельзя';
  if (error.status === 409) return 'Клиника работает с общей анкетой — персональные ссылки недоступны';
  if (error.status === 400) {
    if (/doctor/i.test(error.message)) return 'Врач больше не ведёт приём — выберите другого';
    // Тексты проверок backend уже по-русски; прочие — общим текстом.
    if (HAS_CYRILLIC.test(error.message)) return error.message;
    return 'Проверьте поля формы';
  }
  return 'Не удалось создать ссылку. Попробуйте ещё раз.';
};

const DOCTORS_NOTE: Record<'loading' | 'failed' | 'empty', string> = {
  loading: 'Загружаем врачей…',
  failed: 'Не удалось загрузить врачей — закройте окно и откройте снова',
  empty: 'В клинике нет активных врачей',
};

interface NewLinkModalProps {
  clinicId: string;
  doctors: DoctorOption[];
  doctorsStatus: 'loading' | 'ready' | 'failed';
  onClose: () => void;
  /** Ссылка создана: обновить список и открыть анкету. */
  onCreated: (created: RegistryQuestionnaireCreated) => void;
}

/**
 * «Новая ссылка»: ФИО, врач и время приёма → персональная ссылка и QR.
 * Ссылка показывается один раз — потом её можно только перевыпустить.
 */
export const NewLinkModal = ({
  clinicId,
  doctors,
  doctorsStatus,
  onClose,
  onCreated,
}: NewLinkModalProps) => {
  const [form, setForm] = useState<NewLinkForm>(() => ({
    ...EMPTY_NEW_LINK,
    date: toDateInputValue(new Date()),
    doctorId: doctors.length === 1 ? doctors[0].value : '',
  }));
  const [errors, setErrors] = useState<NewLinkErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegistryQuestionnaireCreated | null>(null);
  // Состояние обновится только после рендера: без ссылки два клика подряд
  // создали бы две анкеты.
  const savingRef = useRef(false);

  // Врачи могли загрузиться после открытия окна: единственного подставляем.
  useEffect(() => {
    if (doctors.length !== 1) return;
    setForm((current) => (current.doctorId ? current : { ...current, doctorId: doctors[0].value }));
  }, [doctors]);

  let doctorsNote: string | null = null;
  if (doctorsStatus === 'loading') doctorsNote = DOCTORS_NOTE.loading;
  else if (doctorsStatus === 'failed') doctorsNote = DOCTORS_NOTE.failed;
  else if (doctors.length === 0) doctorsNote = DOCTORS_NOTE.empty;

  const set = (field: keyof NewLinkForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateNewLink(form, toDateInputValue(new Date()));
    setErrors(found);
    if (Object.keys(found).length > 0 || savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);
    setServerError(null);
    try {
      const result = await mainApi.clinicQuestionnaires.create(clinicId, buildNewLinkPayload(form));
      setCreated(result);
      onCreated(result);
    } catch (error) {
      logWarn('Регистратура: ссылка не создана', error);
      setServerError(createErrorText(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (created) {
    return (
      // Ссылка показывается один раз: случайный клик мимо окна или Esc не
      // должны её терять — закрыть можно только кнопкой «Готово».
      <ModalShell title="Ссылка готова" onClose={onClose} closeDisabled>
        <LinkQrCard item={inviteLinkItem(created)} />
        <div className="mt-5 flex justify-between">
          <button
            type="button"
            className={LINK_BUTTON_CLASS}
            onClick={() => {
              setCreated(null);
              setForm((current) => ({ ...EMPTY_NEW_LINK, date: current.date, doctorId: current.doctorId }));
            }}
          >
            Ещё одна ссылка
          </button>
          <button type="button" className={LINK_BUTTON_CLASS} onClick={onClose}>
            Готово
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Новая ссылка на анкету" onClose={onClose} closeDisabled={isSaving}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
        <FieldRow label="Фамилия" htmlFor="nl-last" error={errors.lastName}>
          <input id="nl-last" className={FIELD} value={form.lastName} onChange={set('lastName')} maxLength={255} autoFocus />
        </FieldRow>
        <FieldRow label="Имя" htmlFor="nl-first" error={errors.firstName}>
          <input id="nl-first" className={FIELD} value={form.firstName} onChange={set('firstName')} maxLength={255} />
        </FieldRow>
        <FieldRow label="Отчество" hint="Если есть" htmlFor="nl-middle">
          <input id="nl-middle" className={FIELD} value={form.middleName} onChange={set('middleName')} maxLength={255} />
        </FieldRow>
        <FieldRow label="Врач" htmlFor="nl-doctor" error={errors.doctorId} note={doctorsNote}>
          <select id="nl-doctor" className={FIELD} value={form.doctorId} onChange={set('doctorId')}>
            <option value="">Выберите врача</option>
            {doctors.map((doctor) => (
              <option key={doctor.value} value={doctor.value}>
                {doctor.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Дата приёма" htmlFor="nl-date" error={errors.date}>
          <input id="nl-date" type="date" className={FIELD} value={form.date} onChange={set('date')} />
        </FieldRow>
        <FieldRow label="Время приёма" htmlFor="nl-time" error={errors.time}>
          <input id="nl-time" type="time" className={FIELD} value={form.time} onChange={set('time')} />
        </FieldRow>

        {serverError ? (
          <p role="alert" className="mt-2 text-sm text-[#D91528]">
            {serverError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-4 h-11 self-end rounded-xl bg-[#5D8CF1] px-6 text-sm font-medium text-white hover:bg-[#769CEF] disabled:opacity-60"
        >
          {isSaving ? 'Создаём…' : 'Создать ссылку'}
        </button>
      </form>
    </ModalShell>
  );
};
