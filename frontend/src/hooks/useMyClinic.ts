'use client';

import { useEffect, useState } from 'react';
import type { MyClinicRead } from '@/api';
import { mainApi } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logWarn } from '@/lib/logger';

interface MyClinicState {
  clinic: MyClinicRead | null;
  isLoading: boolean;
  /** `no_clinic` — пользователь не состоит в клинике (404), это не сбой. */
  error: 'no_clinic' | 'failed' | null;
}

/** Клиника текущего пользователя (`GET /me/clinic`), один раз при монтировании. */
export const useMyClinic = (): MyClinicState => {
  const [state, setState] = useState<MyClinicState>({
    clinic: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    mainApi.myClinic
      .get({ signal: controller.signal })
      .then((clinic) => setState({ clinic, isLoading: false, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        const noClinic = error instanceof ApiError && error.status === 404;
        if (!noClinic) logWarn('Клиника пользователя: не удалось загрузить', error);
        setState({ clinic: null, isLoading: false, error: noClinic ? 'no_clinic' : 'failed' });
      });
    return () => controller.abort();
  }, []);

  return state;
};
