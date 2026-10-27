'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  RegistryQuestionnaireDetail,
  RegistryQuestionnaireItem,
  RegistryQuestionnaireQuery,
} from '@/api';
import { mainApi } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logWarn } from '@/lib/logger';

interface Loaded<T> {
  /** Что запрашивали: фильтры или id анкеты. */
  baseKey: string;
  /** Какой попытке принадлежит результат. */
  key: string;
  data: T | null;
  error: 'not_found' | 'failed' | null;
}

/**
 * Загрузка по ключу запроса. Смена ключа отменяет прежний запрос.
 *
 * `reload` перечитывает тот же запрос «тихо»: прежние данные остаются на
 * экране до ответа и не пропадают, если обновление не удалось. Иначе после
 * каждого действия (и фонового обновления) список мигал бы крутилкой, а
 * открытая анкета сменялась бы ошибкой сети, хотя действие прошло.
 * Данные другого ключа не показываются никогда: в карточке не должно
 * оказаться чужого пациента.
 */
const useKeyedLoad = <T,>(
  baseKey: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  context: string,
) => {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const key = baseKey === null ? null : `${baseKey}#${attempt}`;

  useEffect(() => {
    if (baseKey === null || key === null) return;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setLoaded({ baseKey, key, data, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        const notFound = error instanceof ApiError && error.status === 404;
        if (!notFound) logWarn(context, error);
        setLoaded((previous) => ({
          baseKey,
          key,
          // Анкету удалили — показывать нечего; сбой сети — прежнее остаётся.
          data: !notFound && previous?.baseKey === baseKey ? previous.data : null,
          error: notFound ? 'not_found' : 'failed',
        }));
      });
    return () => controller.abort();
    // `load` пересоздаётся на каждом рендере; запрос определяет ключ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const isSameRequest = loaded !== null && loaded.baseKey === baseKey;

  return {
    data: isSameRequest ? loaded.data : null,
    error: isSameRequest && loaded.key === key ? loaded.error : null,
    isLoading: key !== null && loaded?.key !== key,
    reload,
  };
};

/** Анкеты пациентов клиники за день с фильтрами. */
export const useRegistryList = (clinicId: string | null, query: RegistryQuestionnaireQuery) => {
  const baseKey = clinicId === null ? null : `${clinicId}|${JSON.stringify(query)}`;
  const result = useKeyedLoad<RegistryQuestionnaireItem[]>(
    baseKey,
    (signal) => mainApi.clinicQuestionnaires.list(clinicId as string, query, { signal }),
    'Регистратура: список анкет не загружен',
  );
  return { ...result, items: result.data ?? [] };
};

/** Одна анкета: шапка, статус и карточка для печати. */
export const useRegistryDetail = (clinicId: string | null, id: string | null) =>
  useKeyedLoad<RegistryQuestionnaireDetail>(
    clinicId === null || id === null ? null : `${clinicId}|${id}`,
    (signal) => mainApi.clinicQuestionnaires.get(clinicId as string, id as string, { signal }),
    'Регистратура: анкета не загружена',
  );
