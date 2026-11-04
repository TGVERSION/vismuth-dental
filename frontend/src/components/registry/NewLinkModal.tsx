'use client';

import { useRef, useState } from 'react';
import type { RegistryQuestionnaireCreated } from '@/api';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/settings/clinics/ModalShell';
import { FieldRow, INPUT_CLASS } from '@/components/settings/clinics/fields';
import { LinkQrCard } from '@/components/doctor-questionnaires/LinkQrCard';
import { fieldFillClass } from '@/lib/field-fill';
import { logWarn } from '@/lib/logger';
import {
  EMPTY_NEW_LINK,
  buildNewLinkPayload,
  inviteLinkItem,
  validateNewLink,
  type NewLinkErrors,
  type NewLinkForm,
} from '@/lib/registry';

const HAS_CYRILLIC = /[а-яё]/i;

/** Текст ошибки для регистратуры — только по-русски. */
const createErrorText = (error: unknown): string => {
  if (!(error instanceof ApiError))
    return 'Не удалось создать ссылку. Проверьте интернет и попробуйте ещё раз.';
  if (error.status === 503)
    return 'Доступ клиники к сервису закончился — новые ссылки создать нельзя';
  if (error.status === 409)
    return 'Клиника работает с общей анкетой — персональные ссылки недоступны';
  if (error.status === 400 || error.status === 422) {
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
 * Поля и кнопки — как в окне приглашения сотрудника (`InviteMemberModal`).
 */
export const NewLinkModal = ({
  clinicId,
  onClose,
  onCreated,
}: NewLinkModalProps) => {
  const [form, setForm] = useState<NewLinkForm>(EMPTY_NEW_LINK);
  const [errors, setErrors] = useState<NewLinkErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegistryQuestionnaireCreated | null>(
    null,
  );
  // Состояние обновится только после рендера: без ссылки два клика подряд
  // создали бы две анкеты.
  const savingRef = useRef(false);

  const set =
    (field: keyof NewLinkForm) => (event: { target: { value: string } }) =>
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
      const result = await mainApi.clinicQuestionnaires.create(
        clinicId,
        buildNewLinkPayload(form),
      );
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
        <div className="mt-7.5 flex flex-col gap-3">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={onClose}
          >
            Готово
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setCreated(null);
              setForm(EMPTY_NEW_LINK);
            }}
          >
            Ещё одна ссылка
          </button>
        </div>
      </ModalShell>
    );
  }

  const field = (value: string) => `${INPUT_CLASS} ${fieldFillClass(value)}`;

  return (
    <ModalShell
      title="Новая ссылка на анкету"
      onClose={onClose}
      closeDisabled={isSaving}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
        <FieldRow label="Фамилия" htmlFor="nl-last" error={errors.lastName}>
          <input
            id="nl-last"
            className={field(form.lastName)}
            value={form.lastName}
            onChange={set('lastName')}
            maxLength={255}
            autoFocus
          />
        </FieldRow>
        <FieldRow label="Имя" htmlFor="nl-first" error={errors.firstName}>
          <input
            id="nl-first"
            className={field(form.firstName)}
            value={form.firstName}
            onChange={set('firstName')}
            maxLength={255}
          />
        </FieldRow>
        <FieldRow label="Отчество" hint="Если есть" htmlFor="nl-middle">
          <input
            id="nl-middle"
            className={field(form.middleName)}
            value={form.middleName}
            onChange={set('middleName')}
            maxLength={255}
          />
        </FieldRow>

        <FieldRow label="Дата рождения" htmlFor="nl-birth">
          <input
            id="nl-birth"
            type="date"
            className={field(form.birthDate ?? '')}
            value={form.birthDate ?? ''}
            onChange={set('birthDate')}
            max={new Date().toISOString().slice(0, 10)}
          />
        </FieldRow>

        {serverError ? (
          <p role="alert" className="mt-3 text-sm text-[#E53E3E]">
            {serverError}
          </p>
        ) : null}

        <div className="mt-7.5 flex flex-col gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className={PRIMARY_BUTTON_CLASS}
          >
            {isSaving ? 'Создаём…' : 'Создать ссылку'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={SECONDARY_BUTTON_CLASS}
          >
            Отмена
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
