'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RegistryQuestionnaireDetail } from '@/api';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { ModalShell } from '@/components/settings/clinics/ModalShell';
import { LINK_BUTTON_CLASS } from '@/components/settings/clinics/fields';
import { LinkQrCard } from '@/components/doctor-questionnaires/LinkQrCard';
import { logWarn } from '@/lib/logger';
import {
  inviteLinkItem,
  patientFullName,
  registryActions,
  registryWhenLine,
} from '@/lib/registry';
import { printSheet } from '@/lib/registry-print';
import { AnketaPrintSheet } from './AnketaPrintSheet';
import { DentalCardBody } from './DentalCardBody';

/** Режим печати анкеты: правила в globals.css действуют только под ним. */
const PRINT_MODE_ATTR = 'data-print-mode';

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
  if (status === 409)
    return {
      text: 'Анкета уже изменилась — показываем актуальное состояние',
      refresh: true,
    };
  if (status === 410)
    return {
      text: 'Срок ссылки истёк — создайте пациенту новую',
      refresh: true,
    };
  if (status === 404) return { text: 'Анкета уже удалена', refresh: true };
  return {
    text: 'Не получилось. Проверьте интернет и попробуйте ещё раз.',
    refresh: false,
  };
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
  const [isPrinting, setIsPrinting] = useState(false);

  // Событие эффекта: видит свежие данные анкеты, но не перевешивает слушатель.
  const markPrinted = useEffectEvent(() => {
    if (questionnaire.printed_at) return;
    void run(
      () =>
        mainApi.clinicQuestionnaires.markPrinted(clinicId, questionnaire.id),
      onChanged,
    );
  });

  // Режим печати снимается по afterprint (и при уходе с карточки), а не сразу
  // после window.print(): там, где вызов не ждёт диалога, лист исчез бы до
  // печати. После печати анкета отмечается распечатанной — браузер не
  // сообщает, нажали «Печать» или «Отмена», поэтому отметка ставится в любом
  // случае; регистратура видит её в списке.
  useEffect(() => {
    const root = document.documentElement;
    const endPrint = () => {
      if (root.getAttribute(PRINT_MODE_ATTR) !== 'anketa') return;
      root.removeAttribute(PRINT_MODE_ATTR);
      setIsPrinting(false);
      markPrinted();
    };
    window.addEventListener('afterprint', endPrint);
    return () => {
      window.removeEventListener('afterprint', endPrint);
      if (root.getAttribute(PRINT_MODE_ATTR) === 'anketa')
        root.removeAttribute(PRINT_MODE_ATTR);
    };
  }, []);

  const actions = registryActions(questionnaire.status);
  const sheet = printSheet(questionnaire);

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
        const { url } = await mainApi.clinicQuestionnaires.regenerateLink(
          clinicId,
          questionnaire.id,
        );
        setNewUrl(url);
      },
      () => undefined,
    );

  const print = () => {
    // Лист должен оказаться в DOM до вызова print().
    flushSync(() => setIsPrinting(true));
    document.documentElement.setAttribute(PRINT_MODE_ATTR, 'anketa');
    window.print();
  };

  const markSigned = () =>
    run(
      () => mainApi.clinicQuestionnaires.markSigned(clinicId, questionnaire.id),
      onChanged,
    );

  const remove = () =>
    run(
      () => mainApi.clinicQuestionnaires.remove(clinicId, questionnaire.id),
      () => {
        setConfirmDelete(false);
        onDeleted();
      },
    );

  return (
    <article className="flex min-w-0 flex-col gap-9 break-words">
      {/* Шапка — как у карточки анкеты врача. */}
      <header className="flex flex-wrap items-baseline gap-x-9 gap-y-2 text-[var(--ui-color-alabaster-950)]">
        <h2 className="min-w-0 flex-1 truncate text-[length:var(--ui-font-size-20)] font-normal">
          {patientFullName(questionnaire)}
        </h2>
        {questionnaire.completed_at ? (
          <span className="shrink-0 text-[length:var(--ui-font-size-14)]">
            {registryWhenLine(questionnaire)}
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {actions.canPrint && sheet ? (
          <button
            type="button"
            onClick={print}
            disabled={isBusy}
            className="vismuth-button vismuth-button--secondary"
          >
            Распечатать
          </button>
        ) : null}
        {actions.canMarkSigned ? (
          <button
            type="button"
            className={LINK_BUTTON_CLASS}
            disabled={isBusy}
            onClick={markSigned}
          >
            Отметить подписанной
          </button>
        ) : null}
        {actions.canResendLink ? (
          <button
            type="button"
            className={LINK_BUTTON_CLASS}
            disabled={isBusy}
            onClick={resendLink}
          >
            Новая ссылка
          </button>
        ) : null}
        {actions.canDelete ? (
          <button
            type="button"
            className="cursor-pointer text-sm text-[var(--ui-color-red-600)] hover:underline disabled:opacity-50"
            disabled={isBusy}
            onClick={() => setConfirmDelete(true)}
          >
            Удалить
          </button>
        ) : null}
      </div>
      {sheet && sheet.continuation.length > 0 ? (
        <p
          role="status"
          className="rounded-lg bg-[var(--ui-color-yellow-50)] px-3 py-2 text-sm text-[var(--ui-color-yellow-900)]"
        >
          В анкете есть длинные ответы. Они будут полностью напечатаны на листе
          продолжения вместе с основным бланком. Проверьте и подпишите все
          листы.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--ui-color-red-600)]">
          {error}
        </p>
      ) : null}

      {questionnaire.structured ? (
        <DentalCardBody
          structured={questionnaire.structured}
          gaps={questionnaire.gaps}
        />
      ) : (
        <p className="py-10 text-center text-[var(--ui-color-alabaster-950)]">
          {questionnaire.status === 'invited'
            ? 'Пациент ещё не открывал ссылку'
            : 'Пациент заполняет анкету'}
        </p>
      )}

      {isPrinting && sheet ? <AnketaPrintSheet sheet={sheet} /> : null}

      {newUrl ? (
        <ModalShell
          title="Новая ссылка"
          onClose={() => setNewUrl(null)}
          closeDisabled
        >
          <p className="mb-4 text-sm text-[var(--ui-color-alabaster-950)]">
            Прежняя ссылка больше не работает.
          </p>
          <LinkQrCard
            item={inviteLinkItem({ ...questionnaire, url: newUrl })}
          />
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              onClick={() => setNewUrl(null)}
            >
              Готово
            </button>
          </div>
        </ModalShell>
      ) : null}

      {confirmDelete ? (
        <ModalShell
          title="Удалить ссылку?"
          onClose={() => setConfirmDelete(false)}
          closeDisabled={isBusy}
        >
          <p className="text-[var(--ui-color-alabaster-dark-800)]">
            Анкета {patientFullName(questionnaire)} будет удалена, ссылка
            перестанет работать.
          </p>
          <div className="mt-6 flex justify-end gap-5">
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              onClick={() => setConfirmDelete(false)}
            >
              Отмена
            </button>
            <button
              type="button"
              className="cursor-pointer text-sm font-medium text-[var(--ui-color-red-600)] hover:underline disabled:opacity-50"
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
