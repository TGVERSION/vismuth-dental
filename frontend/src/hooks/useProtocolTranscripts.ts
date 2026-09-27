'use client';

import { useCallback, useEffect, useState } from 'react';
import { mainApi } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { selectTranscriptItems, type TranscriptItem } from '@/lib/transcripts';

interface LoadedTranscripts {
  protocolId: string;
  /** Номер загрузки: отличает перезагрузку того же протокола от первой. */
  key: number;
  items: TranscriptItem[];
  failed: boolean;
}

/**
 * Завершённые записи приёма протокола.
 *
 * Состояние выводится из текущего протокола, а не сбрасывается эффектом: при
 * переходе на другой протокол чужой список исчезает сам. Во время перезагрузки
 * того же протокола прежний список остаётся на экране — панель не мигает.
 */
export const useProtocolTranscripts = (protocolId: string | null) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<LoadedTranscripts | null>(null);

  useEffect(() => {
    if (!protocolId) return;

    const controller = new AbortController();

    mainApi.speech
      .findByProtocol(protocolId, { signal: controller.signal })
      .then((sessions) => {
        setLoaded({
          protocolId,
          key: reloadKey,
          items: selectTranscriptItems(sessions),
          failed: false,
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        // 404 — сервис распознавания ещё не подключён. Это не сбой: записей
        // просто нет, и показывать ошибку врачу незачем.
        const notConnected = error instanceof ApiError && error.status === 404;
        setLoaded({
          protocolId,
          key: reloadKey,
          items: [],
          failed: !notConnected,
        });
      });

    return () => controller.abort();
  }, [protocolId, reloadKey]);

  const isCurrent = loaded !== null && loaded.protocolId === protocolId;

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    items: isCurrent ? loaded.items : [],
    isLoading: !!protocolId && (!isCurrent || loaded.key !== reloadKey),
    failed: isCurrent && loaded.failed,
    reload,
  };
};
