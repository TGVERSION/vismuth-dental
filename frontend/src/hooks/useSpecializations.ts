'use client';

import { useEffect, useState } from 'react';
import { mainApi, type SpecializationRead } from '@/api';
import { logWarn } from '@/lib/logger';

/** Справочник специализаций: загружается один раз при монтировании. */
export const useSpecializations = () => {
  const [specializations, setSpecializations] = useState<SpecializationRead[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mainApi.specializations
      .list()
      .then((data) => {
        if (cancelled) return;
        setSpecializations(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logWarn('Не удалось загрузить специализации', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { specializations, loading, error };
};
