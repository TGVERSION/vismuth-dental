'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mainApi, type DoctorQuestionnaireListItem } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import {
  buildListQuery,
  isVisibleInList,
  type QuestionnaireListFilters,
} from '@/lib/doctor-questionnaires';
import { logWarn } from '@/lib/logger';

/** Пауза после ввода в поиск, прежде чем уйдёт запрос. */
const SEARCH_DEBOUNCE_MS = 300;

export type QuestionnaireListError = 'forbidden' | 'failed';

interface ListResult {
  /** Какому запросу принадлежит результат. */
  key: string;
  filterKey: string;
  items: DoctorQuestionnaireListItem[];
  error: QuestionnaireListError | null;
}

/**
 * Список анкет врача по фильтрам.
 *
 * Поиск уходит с задержкой, дата и тип — сразу. Каждый новый запрос отменяет
 * предыдущий: ответ устаревшего запроса не перезапишет результат нового.
 * При повторной загрузке того же фильтра список остаётся на месте.
 */
export const useDoctorQuestionnaireList = ({
  search,
  date,
  visitType,
  utcOffsetMinutes,
}: QuestionnaireListFilters & { utcOffsetMinutes: number }) => {
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
    () => ({
      ...buildListQuery({ search: debouncedSearch, date, visitType }),
      by_completion: true,
      exclude_dental: true,
      utc_offset_minutes: utcOffsetMinutes,
    }),
    [debouncedSearch, date, visitType, utcOffsetMinutes],
  );
  const filterKey = JSON.stringify(query);
  const requestKey = `${filterKey}#${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();

    mainApi.doctorQuestionnaires
      .list(query, { signal: controller.signal })
      .then((data) => {
        setResult({
          key: requestKey,
          filterKey,
          items: data.filter(isVisibleInList),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        logWarn('Анкеты: не удалось загрузить список', error);
        setResult((previous) => ({
          key: requestKey,
          filterKey,
          items: previous?.filterKey === filterKey ? previous.items : [],
          error:
            error instanceof ApiError && error.status === 403
              ? 'forbidden'
              : 'failed',
        }));
      });

    return () => controller.abort();
  }, [filterKey, query, requestKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  const isLoading = result?.key !== requestKey;

  return {
    items: result?.filterKey === filterKey ? result.items : [],
    /** Ответа ещё не было ни разу — показывать спиннер вместо списка. */
    isInitialLoading: result === null,
    isLoading,
    error: isLoading ? null : (result?.error ?? null),
    retry,
  };
};
