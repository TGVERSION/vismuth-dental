'use client';

import { useRef, useState } from 'react';
import type { RegistryQuestionnaireDetail } from '@/api';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { LINK_BUTTON_CLASS } from '@/components/settings/clinics/fields';
import { LinkQrCard } from '@/components/doctor-questionnaires/LinkQrCard';
import { appointmentLine } from '@/lib/dental-questionnaire';
import { logWarn } from '@/lib/logger';
import {
  inviteLinkItem,
  patientFullName,
  registryActions,
  registryStatusView,
} from '@/lib/registry';
import { DentalCardBody } from './DentalCardBody';

interface RegistryDetailProps {
  clinicId: string;
  questionnaire: RegistryQuestionnaireDetail;
  /** Анкета изменилась на сервере: перечитать её и список. */
  onChanged: () => void;
  /** Анкета удалена: закрыть карточку. */
  onDeleted: () => void;
}

/**
 * Что сказать регистратуре, если действие не прошло. Конфликт значит, что
 * анкета успела измениться (пациент дозаполнил, ссылка истекла, анкету
 * удалили в другой вкладке), — карточку после этого надо перечитать.
 */
const actionError = (error: unknown): { text: string; refresh: boolean } => {
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 409) return { text: 'Анкета уже изменилась — показываем актуальное состояние', refresh: true };
  if (status === 410) return { text: 'Срок ссылки истёк — создайте пациенту новую', refresh: true };
  if (status === 404) return { text: 'Анкета уже удалена', refresh: true };
  return { text: 'Не получилось. Проверьте интернет и попробуйте ещё раз.', refresh: false };
};

/** Открытая анкета у регистратуры: кто, к кому, статус, действия и карточка. */
export const RegistryDetail = ({
  clinicId,
  questionnaire,
  onChanged,
  onDeleted,
}: RegistryDetailProps) => {
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const status = registryStatusView(questionnaire.status);
  const actions = registryActions(questionnaire.status);
  const appointment = appointmentLine(questionnaire.appointment_date, questionnaire.appointment_time);

  const run = async (action: () => Promise<unknown>, after: () => void) => {
    // Защита от двойного клика: два перевыпуска ссылки подряд отменили бы
    // друг друга, и в окне могла бы оказаться уже недействительная ссылка.
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    setError(null);
    try {
      await action();
      after();
    } catch (caught) {
      logWarn('Регистратура: действие с анкетой не выполнено', caught);
      const { text, refresh } = actionError(caught);
      setError(text);
      if (refresh) onChanged();
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  };

  const resendLink = () =>
    run(
      async () => {
        const { url } = await mainApi.clinicQuestionnaires.regenerateLink(clinicId, questionnaire.id);
        setNewUrl(url);
      },
      () => undefined,
    );

  const markSigned = () =>
    run(() => mainApi.clinicQuestionnaires.markSigned(clinicId, questionnaire.id), onChanged);

  const remove = () =>
    run(() => mainApi.clinicQuestionnaires.remove(clinicId, questionnaire.id), () => {
      setConfirmDelete(false);
      onDeleted();
    });

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[#202020]">{patientFullName(questionnaire)}</h2>
          <p className="mt-1 text-sm text-[#6C757D]">
            {[appointment, questionnaire.doctor_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.className}`}>
          {status.label}
        </span>
      </header>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {actions.canMarkSigned ? (
          <button type="button" className={LINK_BUTTON_CLASS} disabled={isBusy} onClick={markSigned}>
            Отметить подписанной
          </button>
        ) : null}
        {actions.canResendLink ? (
          <button type="button" className={LINK_BUTTON_CLASS} disabled={isBusy} onClick={resendLink}>
            Новая ссылка
          </button>
        ) : null}
        {actions.canDelete ? (
          <button
            type="button"
            className="cursor-pointer text-sm text-[#D91528] hover:underline disabled:opacity-50"
            disabled={isBusy}
            onClick={() => setConfirmDelete(true)}
          >
            Удалить
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[#D91528]">
          {error}
        </p>
      ) : null}

      {questionnaire.structured ? (
        <DentalCardBody structured={questionnaire.structured} gaps={questionnaire.gaps} />
      ) : (
        <p className="rounded-xl bg-[#F7F9FB] px-4 py-6 text-center text-[#6C757D]">
          {questionnaire.status === 'invited'
            ? 'Пациент ещё не открывал ссылку'
            : 'Пациент заполняет анкету'}
        </p>
      )}

      {newUrl ? (
        <ModalShell title="Новая ссылка" onClose={() => setNewUrl(null)} closeDisabled>
          <p className="mb-4 text-sm text-[#6C757D]">Прежняя ссылка больше не работает.</p>
          <LinkQrCard item={inviteLinkItem({ ...questionnaire, url: newUrl })} />
          <div className="mt-5 flex justify-end">
            <button type="button" className={LINK_BUTTON_CLASS} onClick={() => setNewUrl(null)}>
              Готово
            </button>
          </div>
        </ModalShell>
      ) : null}

      {confirmDelete ? (
        <ModalShell title="Удалить ссылку?" onClose={() => setConfirmDelete(false)} closeDisabled={isBusy}>
          <p className="text-[#202020]">
            Анкета {patientFullName(questionnaire)} будет удалена, ссылка перестанет работать.
          </p>
          <div className="mt-6 flex justify-end gap-5">
            <button type="button" className={LINK_BUTTON_CLASS} onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="cursor-pointer text-sm font-medium text-[#D91528] hover:underline disabled:opacity-50"
              disabled={isBusy}
              onClick={remove}
            >
              Удалить
            </button>
          </div>
        </ModalShell>
      ) : null}
    </article>
  );
};
