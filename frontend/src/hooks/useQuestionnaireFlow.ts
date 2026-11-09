'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { mainApi } from '@/api';
import type {
  PublicLink,
  PublicLinkDoctor,
  QuestionnaireStep,
  QuestionnaireStepAnswer,
} from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import {
  isSameStep,
  linkBlock,
  parseDoctorOptions,
  screenForStep,
  startErrorBlock,
  type QuestionnaireBlock,
} from '@/lib/questionnaire';
import {
  browserStorage,
  clearSession,
  generateDeviceId,
  parseSession,
  readDeviceId,
  readSessionRaw,
  saveSession,
  type StoredQuestionnaire,
} from '@/lib/questionnaire-storage';
import { logError } from '@/lib/logger';
import { gastroMeta } from '@/lib/gastro-questionnaire';

const START_ERROR = 'Не удалось начать анкету. Попробуйте ещё раз.';
const LINK_NOT_FOUND_ERROR = 'Ссылка недействительна. Уточните её в клинике.';
const EXPIRED_ERROR = 'Анкета устарела. Начните заново.';
const RESUME_ERROR = 'Не удалось продолжить анкету. Попробуйте ещё раз.';
const SUBMIT_ERROR = 'Не удалось отправить ответ. Попробуйте ещё раз.';

/** Чем закончился старт анкеты. */
export type StartOutcome = 'started' | 'blocked' | 'failed' | 'skipped';

export interface UseQuestionnaireFlowResult {
  /** Текущий шаг сервера. `null` — анкета не начата. */
  step: QuestionnaireStep | null;
  /** Идентификатор активной анкеты — ключ ленты чата. */
  questionnaireId: string | null;
  /** Заглушка: из ошибки старта или из ссылки. */
  block: QuestionnaireBlock | null;
  isStarting: boolean;
  /** Идёт проверка сохранённой анкеты после перезагрузки. */
  isResuming: boolean;
  startError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  /** Врачи последнего шага `choose_doctor` — для возврата из чата. */
  doctors: PublicLinkDoctor[];
  start: (doctorMembershipId?: string) => Promise<StartOutcome>;
  submit: (
    answer: QuestionnaireStepAnswer,
  ) => Promise<QuestionnaireStep | null>;
  restartWithDoctor: (membershipId: string) => Promise<StartOutcome>;
  finish: () => void;
}

const statusOf = (error: unknown): number | undefined =>
  error instanceof ApiError ? error.status : undefined;

/** Анкета не найдена или токен недействителен (в том числе брошенная). */
const isExpired = (error: unknown): boolean => {
  const status = statusOf(error);
  return status === 401 || status === 404;
};

/**
 * Исход ответа неизвестен: сервер не ответил (обрыв, таймаут, прокси Next)
 * или ответил 5xx — ответ мог быть принят. На 4xx сервер ответ отклонил.
 */
const isOutcomeUnknown = (error: unknown): boolean => {
  const status = statusOf(error);
  return status === undefined || status >= 500;
};

const sessionStorageOrNull = () => browserStorage('session');

// Хранилище не шлёт событий об изменениях из этой же вкладки, а из других
// вкладок `sessionStorage` не меняется вовсе — подписка не нужна.
const subscribeNoop = () => () => {};

/**
 * Анкета пациента: старт, ответ на шаг, продолжение после перезагрузки.
 *
 * Источник правды — текущий шаг сервера: backend сам ведёт сценарий, а
 * фронтенд показывает то, что пришло. Ответы пациента в браузере не
 * хранятся; в `sessionStorage` — только `id` и `token` анкеты (решение 5).
 */
export const useQuestionnaireFlow = (
  /** Slug из адреса страницы: ключ сохранённой анкеты. */
  slug: string,
  link: PublicLink | null,
): UseQuestionnaireFlowResult => {
  const [questionnaire, setQuestionnaire] =
    useState<StoredQuestionnaire | null>(null);
  const [step, setStep] = useState<QuestionnaireStep | null>(null);
  const [startBlock, setStartBlock] = useState<QuestionnaireBlock | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<PublicLinkDoctor[]>([]);
  const [resumeSettled, setResumeSettled] = useState(false);

  // Источник истины для асинхронных обработчиков: состояние в замыкании
  // устаревает, а ответ должен применяться только к той анкете, для
  // которой ушёл запрос.
  const questionnaireRef = useRef<StoredQuestionnaire | null>(null);
  const stepRef = useRef<QuestionnaireStep | null>(null);
  // Шаг, ответ на который ушёл с неизвестным исходом. Уточнения ИИ идут
  // одним `step_key` подряд, и 409 от повтора не защищает: если первый
  // ответ дошёл, повтор backend принял бы как ответ на следующий вопрос,
  // которого пациент не видел. Поэтому перед повтором шаг перечитывается.
  const unconfirmedRef = useRef<{
    id: string;
    step: QuestionnaireStep;
  } | null>(null);
  const isStartingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const submitAbortRef = useRef<AbortController | null>(null);
  const resumeDoneRef = useRef(false);
  const resumeInFlightRef = useRef(false);
  const deviceIdRef = useRef<string | null>(null);

  // Снимок — сырая строка: новый объект на каждом чтении зациклил бы рендер.
  // На сервере хранилища нет — `null`, поэтому при гидратации расхождения нет.
  const storedRaw = useSyncExternalStore(
    subscribeNoop,
    () => readSessionRaw(sessionStorageOrNull(), slug),
    () => null,
  );
  const stored = useMemo(() => parseSession(storedRaw), [storedRaw]);

  // Незавершённый ответ отменяем при уходе со страницы.
  useEffect(
    () => () => {
      submitAbortRef.current?.abort();
    },
    [],
  );

  const applyStep = useCallback((next: QuestionnaireStep) => {
    stepRef.current = next;
    unconfirmedRef.current = null;
    setStep(next);
    setSubmitError(null);
    if (screenForStep(next) === 'doctor') {
      setDoctors(parseDoctorOptions(next.options));
    }
  }, []);

  const activate = useCallback(
    (active: StoredQuestionnaire, next: QuestionnaireStep) => {
      questionnaireRef.current = active;
      setQuestionnaire(active);
      applyStep(next);
    },
    [applyStep],
  );

  /** Анкета больше недоступна: на приветствие, начать заново. */
  const expire = useCallback(() => {
    clearSession(sessionStorageOrNull(), slug);
    questionnaireRef.current = null;
    stepRef.current = null;
    unconfirmedRef.current = null;
    setQuestionnaire(null);
    setStep(null);
    setSubmitError(null);
    setStartError(EXPIRED_ERROR);
  }, [slug]);

  // Модель работает в фоне. Ожидание не блокирует «Закончить без уточнений».
  useEffect(() => {
    if (!step || gastroMeta(step)?.screen !== 'ai_wait') return;
    const active = questionnaireRef.current;
    if (!active) return;
    const revision = gastroMeta(step)?.revision;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const fresh = await mainApi.questionnaire.getStep(active.id, active.token, { signal: controller.signal });
        const current = stepRef.current;
        if (controller.signal.aborted || questionnaireRef.current?.id !== active.id || !current) return;
        // Параллельная отправка/возврат имеет приоритет над старым ответом polling.
        if (!isSubmittingRef.current && gastroMeta(current)?.screen === 'ai_wait'
          && gastroMeta(current)?.revision === revision && !isSameStep(current, fresh)) applyStep(fresh);
      } catch (caught) {
        if (!controller.signal.aborted && isExpired(caught)) expire();
        // Временная ошибка polling не мешает закончить анкету без модели.
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1200);
    };
    timer = setTimeout(poll, 700);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [step, applyStep, expire]);

  const resume = useCallback(
    async (
      saved: StoredQuestionnaire,
      signal: AbortSignal,
      manual: boolean,
    ): Promise<StartOutcome> => {
      resumeInFlightRef.current = true;

      try {
        const current = await mainApi.questionnaire.getStep(
          saved.id,
          saved.token,
          { signal },
        );
        resumeDoneRef.current = true;
        // Пока шёл запрос, пациент мог начать новую анкету — её не трогаем.
        if (questionnaireRef.current) return 'skipped';

        setStartError(null);
        activate(saved, current);
        return 'started';
      } catch (caught) {
        if (isAbortError(caught)) return 'skipped';
        resumeDoneRef.current = true;
        if (questionnaireRef.current) return 'skipped';

        if (isExpired(caught)) {
          clearSession(sessionStorageOrNull(), slug);
          setStartError(EXPIRED_ERROR);
          return 'failed';
        }

        // Сохранённая анкета остаётся: «Начать» повторит проверку, а не
        // создаст вторую анкету.
        logError('Анкета: ошибка продолжения', caught);
        if (manual) setStartError(RESUME_ERROR);
        return 'failed';
      } finally {
        if (!signal.aborted) {
          resumeInFlightRef.current = false;
          setResumeSettled(true);
        }
      }
    },
    [activate, slug],
  );

  // Продолжение после перезагрузки. Один раз и только пока нет активной
  // анкеты: после старта `saveSession` меняет снимок, и без этой проверки
  // ушёл бы лишний `getStep` параллельно с первым ответом.
  useEffect(() => {
    if (resumeDoneRef.current || questionnaireRef.current) return;

    if (!stored) {
      // Битое значение — удаляем, чтобы не разбирать его на каждом рендере.
      if (storedRaw !== null) clearSession(sessionStorageOrNull(), slug);
      return;
    }

    const controller = new AbortController();
    void resume(stored, controller.signal, false);

    return () => {
      controller.abort();
      resumeInFlightRef.current = false;
    };
  }, [stored, storedRaw, slug, resume]);

  const start = useCallback(
    async (doctorMembershipId?: string): Promise<StartOutcome> => {
      if (isStartingRef.current || resumeInFlightRef.current) return 'skipped';

      isStartingRef.current = true;
      setIsStarting(true);
      setStartError(null);
      setStartBlock(null);

      try {
        // Автоматическая проверка не удалась из-за сети — повторяем её, а не
        // создаём вторую анкету.
        if (!doctorMembershipId && stored && !questionnaireRef.current) {
          return await resume(stored, new AbortController().signal, true);
        }

        if (deviceIdRef.current === null) {
          deviceIdRef.current = readDeviceId(
            browserStorage('local'),
            generateDeviceId,
          );
        }

        // Другой врач выбирается только среди врачей клиники: slug врача
        // backend при неактивном враче отклоняет, даже если выбран другой.
        const requestSlug =
          doctorMembershipId && link && !slug.startsWith('a1.') && !slug.startsWith('s.') ? link.clinic_public_slug : slug;

        const response = await mainApi.questionnaire.start(
          doctorMembershipId
            ? { slug: requestSlug, doctor_membership_id: doctorMembershipId }
            : { slug: requestSlug },
          deviceIdRef.current,
        );

        const active = { id: response.id, token: response.token };
        activate(active, response.step);
        saveSession(sessionStorageOrNull(), slug, active);
        return 'started';
      } catch (caught) {
        logError('Анкета: ошибка старта', caught);

        const blocked = startErrorBlock(caught);
        if (blocked) {
          setStartBlock(blocked);
          return 'blocked';
        }

        setStartError(
          statusOf(caught) === 404 ? LINK_NOT_FOUND_ERROR : START_ERROR,
        );
        return 'failed';
      } finally {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    },
    [activate, link, resume, slug, stored],
  );

  const submit = useCallback(
    async (
      answer: QuestionnaireStepAnswer,
    ): Promise<QuestionnaireStep | null> => {
      const active = questionnaireRef.current;
      if (!active || isSubmittingRef.current) return null;

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      const controller = new AbortController();
      submitAbortRef.current = controller;

      // Ответ применяется, только если анкета всё ещё та же: после «Назад»
      // и выбора другого врача поздний ответ старой анкеты перезаписал бы
      // шаг новой.
      const isCurrent = () =>
        !controller.signal.aborted &&
        questionnaireRef.current?.id === active.id;

      /** Перечитать шаг, когда ответ не принят: 409 или 400. */
      const reload = async (
        rejected: unknown,
      ): Promise<QuestionnaireStep | null> => {
        try {
          const fresh = await mainApi.questionnaire.getStep(
            active.id,
            active.token,
            { signal: controller.signal },
          );
          if (!isCurrent()) return null;

          applyStep(fresh);
          // 409 — ответ уже принят раньше или шаг сменился; 400 со сменой
          // шага — например, повтор данных приёма у уже завершённой анкеты.
          // Продолжаем с актуального шага без ошибки.
          if (
            statusOf(rejected) === 409 ||
            fresh.step_key !== answer.step_key
          ) {
            return fresh;
          }

          logError('Анкета: ответ отклонён', rejected);
          setSubmitError(SUBMIT_ERROR);
          return null;
        } catch (reloadError) {
          if (isAbortError(reloadError) || !isCurrent()) return null;
          if (isExpired(reloadError)) {
            expire();
            return null;
          }

          logError('Анкета: ошибка чтения шага', reloadError);
          setSubmitError(SUBMIT_ERROR);
          return null;
        }
      };

      // Шаг, на который отвечает пациент, — для проверки перед повтором.
      const answeredStep = stepRef.current;

      try {
        const unconfirmed = unconfirmedRef.current;
        if (unconfirmed?.id === active.id) {
          const current = await mainApi.questionnaire.getStep(
            active.id,
            active.token,
            { signal: controller.signal },
          );
          if (!isCurrent()) return null;

          // Шаг сменился — прошлая попытка дошла. Продолжаем с актуального
          // шага, а этот ответ не отправляем: он лёг бы на чужой вопрос.
          if (!isSameStep(current, unconfirmed.step)) {
            applyStep(current);
            return current;
          }
        }

        const next = await mainApi.questionnaire.answer(
          active.id,
          active.token,
          answer,
          { signal: controller.signal },
        );
        if (!isCurrent()) return null;

        applyStep(next);
        return next;
      } catch (caught) {
        if (isAbortError(caught) || !isCurrent()) return null;

        if (isExpired(caught)) {
          expire();
          return null;
        }

        const status = statusOf(caught);
        if (status === 409 || status === 400) {
          return await reload(caught);
        }

        // Сеть, 5xx, таймаут, обрыв прокси Next: пузырь пациента остаётся,
        // «Повторить» сначала перечитает шаг и отправит ответ, только если
        // шаг прежний.
        if (answeredStep && isOutcomeUnknown(caught)) {
          unconfirmedRef.current = { id: active.id, step: answeredStep };
        }
        logError('Анкета: ошибка ответа', caught);
        setSubmitError(SUBMIT_ERROR);
        return null;
      } finally {
        if (submitAbortRef.current === controller) {
          submitAbortRef.current = null;
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      }
    },
    [applyStep, expire],
  );

  const restartWithDoctor = useCallback(
    (membershipId: string): Promise<StartOutcome> => {
      // Прежняя анкета остаётся на сервере брошенной: вернуться на шаг назад
      // backend не умеет.
      submitAbortRef.current?.abort();
      submitAbortRef.current = null;
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      clearSession(sessionStorageOrNull(), slug);
      questionnaireRef.current = null;
      stepRef.current = null;
      unconfirmedRef.current = null;
      setQuestionnaire(null);
      setStep(null);
      setSubmitError(null);

      return start(membershipId);
    },
    [slug, start],
  );

  /** «Закрыть» на экране кода: состояние не сбрасывается, код остаётся. */
  const finish = useCallback(() => {
    clearSession(sessionStorageOrNull(), slug);
  }, [slug]);

  const isResuming =
    stored !== null && questionnaire === null && !resumeSettled;

  return {
    step,
    questionnaireId: questionnaire?.id ?? null,
    block: startBlock ?? linkBlock(link),
    isStarting,
    isResuming,
    startError,
    isSubmitting,
    submitError,
    doctors,
    start,
    submit,
    restartWithDoctor,
    finish,
  };
};
