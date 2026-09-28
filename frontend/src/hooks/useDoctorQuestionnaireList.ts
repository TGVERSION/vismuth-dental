'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mainApi, type DoctorQuestionnaireListItem } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import {
  buildListQuery,
  isVisibleInList,
  sortByTime,
  type QuestionnaireListFilters,
} from '@/lib/doctor-questionnaires';
import { logWarn } from '@/lib/logger';

/** Пауза после ввода в поиск, прежде чем уйдёт запрос. */
const SEARCH_DEBOUNCE_MS = 300;

export type QuestionnaireListError = 'forbidden' | 'failed';

interface ListResult {
  /** Какому запросу принадлежит результат. */
  key: string;
  items: DoctorQuestionnaireListItem[];
  error: QuestionnaireListError | null;
}

/**
 * Список анкет врача по фильтрам.
 *
 * Поиск уходит с задержкой, дата и тип — сразу. Каждый новый запрос отменяет
 * предыдущий: ответ устаревшего запроса не перезапишет результат нового.
 * Пока идёт запрос, прежний список остаётся на месте — колонка не мигает
 * спиннером на каждую букву.
 */
export const useDoctorQuestionnaireList = ({
  search,
  date,
  visitType,
}: QuestionnaireListFilters) => {
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<ListResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(
    () => buildListQuery({ search: debouncedSearch, date, visitType }),
    [debouncedSearch, date, visitType],
  );
  const requestKey = `${JSON.stringify(query)}#${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();

    mainApi.doctorQuestionnaires
      .list(query, { signal: controller.signal })
      .then((data) => {
        setResult({
          key: requestKey,
          items: sortByTime(data.filter(isVisibleInList)),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        logWarn('Анкеты: не удалось загрузить список', error);
        setResult((previous) => ({
          key: requestKey,
          items: previous?.items ?? [],
          error:
            error instanceof ApiError && error.status === 403
              ? 'forbidden'
              : 'failed',
        }));
      });

    return () => controller.abort();
  }, [query, requestKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  const isLoading = result?.key !== requestKey;

  return {
    items: result?.items ?? [],
    /** Ответа ещё не было ни разу — показывать спиннер вместо списка. */
    isInitialLoading: result === null,
    isLoading,
    error: isLoading ? null : (result?.error ?? null),
    retry,
  };
};
