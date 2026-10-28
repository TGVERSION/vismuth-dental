'use client';

import { useRef, useState } from 'react';
import type { RegistryQuestionnaireCreated } from '@/api';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { FieldRow, INPUT_CLASS, LINK_BUTTON_CLASS } from '@/components/settings/clinics/fields';
import { LinkQrCard } from '@/components/doctor-questionnaires/LinkQrCard';
import { logWarn } from '@/lib/logger';
import {
  EMPTY_NEW_LINK,
  buildNewLinkPayload,
  inviteLinkItem,
  validateNewLink,
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
    // Тексты проверок backend уже по-русски; прочие — общим текстом.
    if (HAS_CYRILLIC.test(error.message)) return error.message;
    return 'Проверьте поля формы';
  }
  return 'Не удалось создать ссылку. Попробуйте ещё раз.';
};

interface NewLinkModalProps {
  clinicId: string;
  onClose: () => void;
  /** Ссылка создана: обновить список и открыть анкету. */
  onCreated: (created: RegistryQuestionnaireCreated) => void;
}

/**
 * «Новая ссылка»: ФИО пациента → персональная ссылка и QR. Врач и время
 * приёма не нужны: анкета, как бумажная, к ним не привязана.
 * Ссылка показывается один раз — потом её можно только перевыпустить.
 */
export const NewLinkModal = ({ clinicId, onClose, onCreated }: NewLinkModalProps) => {
  const [form, setForm] = useState<NewLinkForm>(EMPTY_NEW_LINK);
  const [errors, setErrors] = useState<NewLinkErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegistryQuestionnaireCreated | null>(null);
  // Состояние обновится только после рендера: без ссылки два клика подряд
  // создали бы две анкеты.
  const savingRef = useRef(false);

  const set = (field: keyof NewLinkForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateNewLink(form);
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
              setForm(EMPTY_NEW_LINK);
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
