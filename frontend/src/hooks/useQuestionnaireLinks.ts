'use client';

import { useCallback, useEffect, useState } from 'react';
import { mainApi } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logWarn } from '@/lib/logger';
import {
  questionnaireLinks,
  type QuestionnaireLinkItem,
} from '@/lib/questionnaire-links';

export type QuestionnaireLinksError = 'no_clinic' | 'failed';

interface LinksResult {
  /** Какому запросу принадлежит результат. */
  key: number;
  links: QuestionnaireLinkItem[] | null;
  error: QuestionnaireLinksError | null;
}

/**
 * Ссылки анкеты пациента текущего пользователя (`GET /me/clinic`).
 *
 * Хук живёт в окне «Ссылки и QR-код»: каждое открытие загружает ссылки
 * заново, закрытие отменяет запрос. 404 — пользователь не состоит в клинике,
 * это не сбой, а отдельное состояние окна.
 */
export const useQuestionnaireLinks = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<LinksResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    mainApi.myClinic
      .get({ signal: controller.signal })
      .then((data) =>
        setResult({
          key: reloadKey,
          links: questionnaireLinks(data),
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        const noClinic = error instanceof ApiError && error.status === 404;
        if (!noClinic) logWarn('Ссылки анкеты: не удалось загрузить', error);

        setResult({
          key: reloadKey,
          links: null,
          error: noClinic ? 'no_clinic' : 'failed',
        });
      });

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const isCurrent = result !== null && result.key === reloadKey;

  return {
    links: isCurrent ? result.links : null,
    isLoading: !isCurrent,
    error: isCurrent ? result.error : null,
    reload,
  };
};
