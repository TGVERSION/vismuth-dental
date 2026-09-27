'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { mainApi } from '@/api';
import { ApiError } from '@/api/base-client';
import { toast } from 'react-toastify';
import { logError } from '@/lib/logger';
import {
  AUDIO_BITS_PER_SECOND,
  CHUNK_TIMESLICE_MS,
  MAX_SESSION_MS,
  pickRecorderMimeType,
} from '@/lib/voice-recording';

export type RecorderState =
  | 'unsupported'
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'finishing'
  | 'error';

interface UseVisitRecorderOptions {
  protocolId: string | null;
  /** Вызывается после успешного завершения записи: обработка началась. */
  onCompleted: (sessionId: string) => void;
}

interface QueuedChunk {
  seq: number;
  blob: Blob;
}

/** Поддержка не меняется в течение жизни страницы — подписка пустая. */
const subscribeToNothing = () => () => {};

/** Микрофон доступен только в secure context: HTTPS или localhost. */
const detectSupport = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

const describeStartError = (error: unknown): string => {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Доступ к микрофону запрещён. Разрешите его в настройках браузера и попробуйте снова.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Микрофон не найден. Подключите его и попробуйте снова.';
  }
  if (name === 'NotReadableError') {
    return 'Микрофон занят другой программой.';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'Сервис распознавания ещё не подключён.';
  }
  return 'Не удалось начать запись.';
};

/**
 * Запись приёма целиком.
 *
 * Запись нарезается на фрагменты и уходит на сервер по ходу консультации:
 * один blob на сорок минут потерялся бы вместе с вкладкой, а приём не
 * переиграть. Очередь отправки повторяет только сетевые сбои и 5xx — на 401,
 * 403, 413 и 415 запись останавливается, потому что повторять их бессмысленно.
 */
export const useVisitRecorder = ({
  protocolId,
  onCompleted,
}: UseVisitRecorderOptions) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [pendingChunks, setPendingChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>('');
  const seqRef = useRef(0);
  const queueRef = useRef<QueuedChunk[]>([]);
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedResolveRef = useRef<(() => void) | null>(null);
  const fatalRef = useRef(false);

  // Поддержка проверяется через useSyncExternalStore, а не эффектом: на
  // сервере снимок всегда `false` (микрофона там нет), на клиенте — реальный,
  // и React сам разводит эти значения без лишнего состояния.
  const isSupported = useSyncExternalStore(
    subscribeToNothing,
    detectSupport,
    () => false,
  );

  const releaseStream = useCallback(() => {
    // Без остановки дорожек индикатор микрофона в браузере продолжает гореть
    // даже после ухода врача с экрана протокола.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stopTicking = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const failFatally = useCallback(
    (message: string) => {
      fatalRef.current = true;
      queueRef.current = [];
      setPendingChunks(0);
      setError(message);
      setState('error');
      // Запись оборвалась посреди приёма — врач может смотреть в самый низ
      // протокола, далеко от строки состояния.
      toast.error(message, { toastId: `recorder-${message}` });
      stopTicking();
      try {
        recorderRef.current?.stop();
      } catch {
        // Рекордер мог быть уже остановлен — это не ошибка.
      }
      releaseStream();
    },
    [releaseStream, stopTicking],
  );

  /**
   * Последовательная отправка очереди. Номер фрагмента при повторе не меняется.
   *
   * Если отправка уже идёт, возвращается её промис, а не пустой результат:
   * иначе `stop()` не дожидался бы текущей отправки, видел непустую очередь
   * и завершал запись ошибкой, не запустив обработку.
   */
  const flushQueue = useCallback((): Promise<void> => {
    if (fatalRef.current) return Promise.resolve();
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const run = (async () => {
      while (queueRef.current.length > 0 && !fatalRef.current) {
        const sessionId = sessionIdRef.current;
        if (!sessionId) break;

        const chunk = queueRef.current[0];
        try {
          await mainApi.speech.uploadChunk(
            sessionId,
            chunk.blob,
            chunk.seq,
            mimeTypeRef.current,
          );
          queueRef.current.shift();
          setPendingChunks(queueRef.current.length);
        } catch (uploadError) {
          const status =
            uploadError instanceof ApiError ? uploadError.status : undefined;

          if (status === 401 || status === 403) {
            failFatally('Сессия истекла. Запись остановлена, войдите заново.');
            return;
          }
          if (status === 413) {
            failFatally('Превышен предел длительности записи.');
            return;
          }
          if (status === 415) {
            failFatally('Сервер не принимает формат записи этого браузера.');
            return;
          }
          if (status && status >= 400 && status < 500) {
            failFatally('Сервер отклонил фрагмент записи.');
            return;
          }

          // Сеть или 5xx: фрагмент остаётся в очереди и уйдёт следующей
          // попыткой с тем же seq.
          logError('Не удалось отправить фрагмент записи');
          return;
        }
      }
    })().finally(() => {
      flushPromiseRef.current = null;
    });

    flushPromiseRef.current = run;
    return run;
  }, [failFatally]);

  /**
   * Дослать всё, что осталось. Между попытками делается пауза: последний
   * фрагмент попадает в очередь уже после `recorder.stop()`, а связь могла
   * пропасть на секунду.
   */
  const drainQueue = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await flushQueue();
      if (queueRef.current.length === 0 || fatalRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, [flushQueue]);

  // Пока запись идёт, очередь пробуем разгружать регулярно: после обрыва сети
  // фрагменты копятся и должны уехать сами, без действий врача.
  useEffect(() => {
    if (state !== 'recording' && state !== 'paused' && state !== 'finishing') {
      return;
    }
    const timer = setInterval(() => void flushQueue(), 5000);
    return () => clearInterval(timer);
  }, [state, flushQueue]);

  const start = useCallback(async () => {
    if (!protocolId || state === 'starting' || state === 'recording') return;

    setError(null);
    fatalRef.current = false;
    setState('starting');

    try {
      const mimeType = pickRecorderMimeType((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mimeType) {
        setState('unsupported');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { session_id } = await mainApi.speech.createSession({
        protocol_id: protocolId,
      });

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });

      streamRef.current = stream;
      recorderRef.current = recorder;
      sessionIdRef.current = session_id;
      mimeTypeRef.current = mimeType;
      seqRef.current = 0;
      queueRef.current = [];
      setPendingChunks(0);

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        queueRef.current.push({ seq: seqRef.current, blob: event.data });
        seqRef.current += 1;
        setPendingChunks(queueRef.current.length);
        void flushQueue();
      };

      recorder.onerror = () =>
        failFatally('Запись прервалась из-за ошибки браузера.');

      stream.getTracks().forEach((track) => {
        track.onended = () =>
          failFatally('Микрофон отключён. Запись остановлена.');
      });

      recorder.onstop = () => {
        stoppedResolveRef.current?.();
        stoppedResolveRef.current = null;
      };

      // Нарезка задаётся самому рекордеру: таймеры в фоновой вкладке
      // троттлятся, а запись приёма идти не перестаёт.
      recorder.start(CHUNK_TIMESLICE_MS);
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setState('recording');

      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setDurationMs(elapsed);
        if (elapsed >= MAX_SESSION_MS) {
          failFatally('Достигнут предел длительности записи.');
        }
      }, 1000);
    } catch (startError) {
      logError('Не удалось начать запись приёма');
      releaseStream();
      const message = describeStartError(startError);
      setError(message);
      // Отказ микрофона и неподключённый сервис сообщаются только всплывающим
      // уведомлением: строки состояния в тексте протокола нет.
      toast.error(message, { toastId: `recorder-start-${message}` });
      setState('error');
    }
  }, [protocolId, state, flushQueue, failFatally, releaseStream]);

  const pause = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return;
    recorderRef.current.pause();
    stopTicking();
    setState('paused');
  }, [stopTicking]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state !== 'paused') return;
    recorderRef.current.resume();
    // Отсчёт продолжается с уже накопленного времени, а не с нуля.
    startedAtRef.current = Date.now() - durationMs;
    tickRef.current = setInterval(
      () => setDurationMs(Date.now() - startedAtRef.current),
      1000,
    );
    setState('recording');
  }, [durationMs]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    const sessionId = sessionIdRef.current;
    if (!recorder || !sessionId) return;

    setState('finishing');
    stopTicking();

    // Дожидаемся последнего `ondataavailable`, иначе хвост приёма не уедет.
    await new Promise<void>((resolve) => {
      stoppedResolveRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    releaseStream();
    await drainQueue();

    if (fatalRef.current) return;

    if (queueRef.current.length > 0) {
      const message =
        'Часть записи не отправлена: нет связи с сервером. Не закрывайте вкладку.';
      setError(message);
      setState('error');
      toast.error(message, { toastId: 'recorder-pending-chunks' });
      return;
    }

    try {
      await mainApi.speech.complete(sessionId);
      setState('idle');
      setDurationMs(0);
      onCompleted(sessionId);
    } catch (completeError) {
      logError('Не удалось завершить запись приёма');
      const message = 'Запись сохранена, но обработку запустить не удалось.';
      setError(message);
      setState('error');
      toast.error(message, { toastId: 'recorder-complete-failed' });
      throw completeError instanceof Error
        ? completeError
        : new Error('complete failed');
    }
  }, [drainQueue, onCompleted, releaseStream, stopTicking]);

  const cancel = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    stopTicking();
    try {
      recorderRef.current?.stop();
    } catch {
      // Уже остановлен.
    }
    releaseStream();
    queueRef.current = [];
    setPendingChunks(0);
    setDurationMs(0);
    setState('idle');
    setError(null);

    if (sessionId) {
      sessionIdRef.current = null;
      try {
        await mainApi.speech.cancel(sessionId);
      } catch {
        logError('Не удалось удалить отменённую запись');
      }
    }
  }, [releaseStream, stopTicking]);

  const isActive =
    state === 'recording' || state === 'paused' || state === 'finishing';
  const publicState: RecorderState = isSupported ? state : 'unsupported';

  // Уход со страницы во время приёма стоит дороже, чем несохранённая правка.
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isActive]);

  // При размонтировании экрана дорожки микрофона обязаны освободиться.
  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        recorderRef.current?.stop();
      } catch {
        // Уже остановлен.
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return {
    state: publicState,
    durationMs,
    pendingChunks,
    error,
    isActive,
    isSupported,
    start,
    pause,
    resume,
    stop,
    cancel,
  };
};
