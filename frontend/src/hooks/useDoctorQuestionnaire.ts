'use client';

import { useCallback, useEffect, useState } from 'react';
import { mainApi, type DoctorQuestionnaireDetail } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logWarn } from '@/lib/logger';

export type QuestionnaireDetailError = 'forbidden' | 'not_found' | 'failed';

interface DetailResult {
  /** Какому запросу принадлежит результат. */
  key: string;
  data: DoctorQuestionnaireDetail | null;
  error: QuestionnaireDetailError | null;
}

const errorKind = (error: unknown): QuestionnaireDetailError => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    // Backend принимает в пути только UUID: битый `?id=` получает 422, а не
    // 404, и «Повторить» такую анкету не загрузит никогда.
    if (error.status === 404 || error.status === 422) return 'not_found';
  }
  return 'failed';
};

/**
 * Открытая анкета. При смене `id` запрос предыдущей анкеты отменяется, а её
 * данные не показываются: на экране всегда та анкета, что выбрана.
 */
export const useDoctorQuestionnaire = (id: string | null) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<DetailResult | null>(null);

  const requestKey = id ? `${id}#${reloadKey}` : null;

  useEffect(() => {
    if (!id || !requestKey) return;

    const controller = new AbortController();

    mainApi.doctorQuestionnaires
      .get(id, { signal: controller.signal })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        logWarn('Анкеты: не удалось загрузить анкету', error);
        setResult({ key: requestKey, data: null, error: errorKind(error) });
      });

    return () => controller.abort();
  }, [id, requestKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const isCurrent = result !== null && result.key === requestKey;

  return {
    data: isCurrent ? result.data : null,
    isLoading: requestKey !== null && !isCurrent,
    error: isCurrent ? result.error : null,
    reload,
  };
};
