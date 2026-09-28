'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { logWarn } from '@/lib/logger';

/** Адрес экрана протокола: `?id=` — единственное место, где он загружается. */
export const protocolHref = (protocolId: string): string =>
  `/?id=${encodeURIComponent(protocolId)}`;

/**
 * Создание протокола из анкеты и переход на него.
 *
 * «Ровно один протокол из анкеты» гарантирует сервер: на повтор он отвечает
 * 409. Тогда протокол уже создан — в другой вкладке или повторным нажатием, —
 * и врача ведём на него, перечитав анкету.
 */
export const useCreateProtocolFromQuestionnaire = () => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const create = useCallback(
    async (questionnaireId: string, structureId: string): Promise<void> => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setIsCreating(true);

      // После перехода кнопка остаётся заблокированной до ухода со страницы.
      let navigated = false;
      const open = (protocolId: string) => {
        navigated = true;
        router.push(protocolHref(protocolId));
      };

      try {
        const protocol = await mainApi.doctorQuestionnaires.createProtocol(
          questionnaireId,
          { protocol_structure_id: structureId },
        );
        open(protocol.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          try {
            const fresh =
              await mainApi.doctorQuestionnaires.get(questionnaireId);
            if (fresh.protocol_id) {
              open(fresh.protocol_id);
              return;
            }
          } catch (reloadError) {
            logWarn('Анкеты: не удалось перечитать анкету', reloadError);
          }
          toast.error('Не удалось создать протокол');
          return;
        }

        logWarn('Анкеты: не удалось создать протокол', error);
        if (error instanceof ApiError && error.status === 404) {
          toast.error(
            /structure/i.test(error.message)
              ? 'Структура протокола не найдена'
              : 'Анкета не найдена',
          );
        } else {
          toast.error('Не удалось создать протокол');
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current && !navigated) setIsCreating(false);
      }
    },
    [router],
  );

  return { create, isCreating };
};
