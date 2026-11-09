'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/api/main-api';
import { doctorDateRange } from '@/lib/doctor-questionnaires';

/** Только даты доступных пользователю анкет, независимо от выбранного дня. */
export function useQuestionnaireDates(
  scope: string | null,
  query: Record<string, string> = {},
) {
  const key = JSON.stringify(query);
  const [result, setResult] = useState<{ key: string; dates: string[] } | null>(
    null,
  );
  const requestKey = `${scope}:${key}`;
  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    let live = true;
    const range = doctorDateRange();
    apiClient
      .get<string[]>(
        `${scope}/appointment-dates`,
        {
          ...JSON.parse(key),
          date_from: range.min,
          date_to: range.max,
        },
        { signal: controller.signal },
      )
      .then((dates) => {
        if (live) setResult({ key: requestKey, dates });
      })
      .catch(() => {
        if (live) setResult({ key: requestKey, dates: [] });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [scope, key, requestKey]);
  return result?.key === requestKey ? result.dates : [];
}
