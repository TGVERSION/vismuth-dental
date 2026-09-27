'use client';

import { useEffect } from 'react';
import { mainApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { mergeCurrentUser } from '@/lib/current-user';
import { logWarn } from '@/lib/logger';

export const useRefreshCurrentUser = (): void => {
  const isLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!isLoaded || !accessToken) return;
    if (!useAuthStore.getState().user) return;

    let cancelled = false;

    mainApi.serviceUsers
      .serviceUser()
      .then((me) => {
        if (cancelled) return;

        // Пока шёл запрос, пользователь мог выйти или войти под другим
        // аккаунтом — тогда ответ относится к чужой сессии.
        const {
          accessToken: currentToken,
          user,
          setUser,
        } = useAuthStore.getState();
        if (currentToken !== accessToken || !user) return;

        setUser(mergeCurrentUser(user, me));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logWarn('Не удалось обновить данные пользователя', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, accessToken]);
};
