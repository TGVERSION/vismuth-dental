'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { mainApi, type SpeechSessionStatus } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logError } from '@/lib/logger';
import {
  acknowledgeFailures,
  describeMissedFailures,
  describeRecognitionFailure,
  pickUnreportedFailures,
  readAcknowledgedFailures,
} from '@/lib/transcription-errors';

const POLL_INTERVAL_MS = 5000;
/** Предел ожидания: без него спиннер у врача не закончился бы никогда. */
const MAX_WAIT_MS = 20 * 60 * 1000;
/**
 * После стольких неудачных опросов подряд врачу показывается, что связи нет.
 * Один сбой — обычная сетевая мелочь, три подряд при интервале 5 с — это уже
 * 10–15 секунд тишины, о которых стоит знать.
 */
const LOST_AFTER_FAILED_POLLS = 3;

interface UseTranscriptionResultOptions {
  protocolId: string | null;
  /**
   * Результат готов. Вызывается один раз на сессию и только если протокол
   * с тех пор не сменился.
   */
  onReady: (result: SpeechSessionStatus) => void;
  /** Распознавание не удалось: например, чтобы обновить список записей. */
  onFailed?: () => void;
}

/** Состояние привязано к протоколу, чтобы не переезжать на соседний. */
interface WatchedSession {
  sessionId: string;
  protocolId: string;
}

interface TranscriptionError {
  protocolId: string;
  message: string;
}

export const useTranscriptionResult = ({
  protocolId,
  onReady,
  onFailed,
}: UseTranscriptionResultOptions) => {
  const [session, setSession] = useState<WatchedSession | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [errorState, setErrorState] = useState<TranscriptionError | null>(null);
  const [lostSessionId, setLostSessionId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<WatchedSession | null>(null);
  const startedAtRef = useRef(0);
  const failedPollsRef = useRef(0);
  const protocolIdRef = useRef<string | null>(protocolId);
  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);

  useEffect(() => {
    onReadyRef.current = onReady;
    onFailedRef.current = onFailed;
  }, [onReady, onFailed]);

  // Состояние выводится из текущего протокола, а не сбрасывается эффектом:
  // при переходе на другой протокол чужой спиннер и чужая ошибка исчезают
  // сами, без лишнего рендера и без setState в эффекте.
  const isProcessing = session !== null && session.protocolId === protocolId;
  const isConnectionLost =
    isProcessing &&
    lostSessionId !== null &&
    lostSessionId === session.sessionId;
  const error =
    errorState && errorState.protocolId === protocolId
      ? errorState.message
      : null;

  /**
   * Сообщить о сбое распознавания всплывающим уведомлением: в тексте
   * протокола сообщений о сбоях нет. `toastId` гасит дубли: в dev React дважды
   * выполняет эффекты, а опрос и поиск при открытии могут найти один сбой.
   */
  const reportFailure = useCallback(
    (protocol: string, message: string, sessionId?: string) => {
      setErrorState({ protocolId: protocol, message });
      toast.error(message, {
        toastId: `speech-failure-${sessionId ?? message}`,
      });
      if (sessionId) acknowledgeFailures([sessionId]);
      onFailedRef.current?.();
    },
    [],
  );

  /** Снять таймеры и запросы. Состояние не трогает — его считает рендер. */
  const stopPolling = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current = null;
    failedPollsRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    stopPolling();
    setSession(null);
    setProgress(null);
    setLostSessionId(null);
  }, [stopPolling]);

  // Следующий тик планируется через ref: цикл опроса ссылается сам на себя,
  // а прямая самоссылка в `useCallback` заморозила бы устаревшую версию.
  const pollRef = useRef<() => void>(() => {});

  const scheduleNextPoll = useCallback(() => {
    timerRef.current = setTimeout(() => pollRef.current(), POLL_INTERVAL_MS);
  }, []);

  // Опрос цепочкой setTimeout, а не setInterval: иначе запросы наслаиваются,
  // если сервер отвечает медленнее интервала.
  const poll = useCallback(async () => {
    const watched = sessionRef.current;
    if (!watched) return;

    if (Date.now() - startedAtRef.current > MAX_WAIT_MS) {
      stop();
      reportFailure(
        watched.protocolId,
        'Расшифровка занимает слишком долго. Попробуйте позже.',
      );
      return;
    }

    abortRef.current = new AbortController();

    try {
      const status = await mainApi.speech.getStatus(watched.sessionId, {
        signal: abortRef.current.signal,
      });

      // Врач мог уйти на другой протокол, пока летел запрос.
      if (sessionRef.current?.sessionId !== watched.sessionId) return;

      // Сервер ответил — связь есть, счётчик сбоев начинается заново.
      failedPollsRef.current = 0;
      setLostSessionId(null);

      if (status.status === 'done') {
        stop();
        // Результат чужого протокола не применяем ни при каких условиях.
        if (status.protocol_id === watched.protocolId) {
          onReadyRef.current(status);
        }
        return;
      }

      if (status.status === 'error') {
        stop();
        reportFailure(
          watched.protocolId,
          describeRecognitionFailure(status.error),
          watched.sessionId,
        );
        return;
      }

      setProgress(status.progress);
      scheduleNextPoll();
    } catch (pollError) {
      if (isAbortError(pollError)) return;

      const status =
        pollError instanceof ApiError ? pollError.status : undefined;

      if (status === 404) {
        stop();
        reportFailure(
          watched.protocolId,
          'Сессия записи не найдена на сервере: приём не будет расшифрован.',
          watched.sessionId,
        );
        return;
      }
      if (status === 401 || status === 403) {
        stop();
        return;
      }

      // Сетевой сбой или 5xx не повод бросать обработку: пробуем ещё раз, но
      // после нескольких неудач подряд говорим врачу, что связи нет.
      failedPollsRef.current += 1;
      if (failedPollsRef.current >= LOST_AFTER_FAILED_POLLS) {
        setLostSessionId(watched.sessionId);
      }
      logError('Не удалось получить статус расшифровки');
      scheduleNextPoll();
    }
  }, [reportFailure, scheduleNextPoll, stop]);

  useEffect(() => {
    pollRef.current = () => void poll();
  }, [poll]);

  const watch = useCallback(
    (sessionId: string) => {
      const protocol = protocolIdRef.current;
      if (!protocol) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      const watched = { sessionId, protocolId: protocol };
      sessionRef.current = watched;
      startedAtRef.current = Date.now();
      failedPollsRef.current = 0;
      setSession(watched);
      setProgress(null);
      setErrorState(null);
      setLostSessionId(null);
      void poll();
    },
    [poll],
  );

  // Смена протокола: опрос предыдущего прекращается, у нового ищется своя
  // сессия — обработка могла начаться до перезагрузки страницы.
  useEffect(() => {
    protocolIdRef.current = protocolId;
    stopPolling();

    if (!protocolId) return;

    let cancelled = false;

    const findExisting = async () => {
      try {
        const sessions = await mainApi.speech.findByProtocol(protocolId);
        if (cancelled || protocolIdRef.current !== protocolId) return;

        // Сбои, случившиеся, пока врач был на другом экране или закрыл
        // вкладку. Без этого приём, не попавший в протокол, пропадал молча.
        const missed = pickUnreportedFailures(
          sessions,
          readAcknowledgedFailures(),
        );
        const missedMessage = describeMissedFailures(missed);
        if (missedMessage) {
          const missedIds = missed.map((item) => item.session_id);
          setErrorState({ protocolId, message: missedMessage });
          toast.error(missedMessage, {
            toastId: `speech-missed-${missedIds.join(',')}`,
          });
          acknowledgeFailures(missedIds);
        }

        // Готовые записи при открытии протокола НЕ применяются: их результат
        // уже лежит в полях с прошлого раза. Повторное применение дописывало
        // бы старую расшифровку поверх правок врача при каждом открытии, а
        // при нескольких записях выбирало бы из них первую попавшуюся.
        // Посмотреть готовые записи можно в панели расшифровок.
        //
        // Подхватываем только обработку. Сессия в статусе `recording` — это
        // брошенная запись (вкладку закрыли, не остановив): она никогда не
        // станет готовой, и опрашивать её значит вечно крутить спиннер.
        const active = sessions.find((item) => item.status === 'processing');
        if (active) watch(active.session_id);
      } catch {
        // Эндпоинта может не быть вовсе — штатная ситуация до подключения
        // сервиса, молчаливый выход здесь правильный.
      }
    };

    void findExisting();

    return () => {
      cancelled = true;
    };
  }, [protocolId, stopPolling, watch]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { isProcessing, isConnectionLost, progress, error, watch, stop };
};
