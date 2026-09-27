'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mainApi } from '@/api';
import type {
  QuestionnaireCompleteRequest,
  QuestionnaireDoctor,
  QuestionnaireMessage,
} from '@/api';
import { isAbortError } from '@/api/base-client';
import { collectSpecializations } from '@/lib/questionnaire';
import { logError } from '@/lib/logger';

export interface StartedSession {
  sessionId: string;
  firstMessage: QuestionnaireMessage;
}

export interface UseQuestionnaireSessionResult {
  doctors: QuestionnaireDoctor[];
  specializations: string[];
  isLoadingDoctors: boolean;
  doctorsError: string | null;
  reloadDoctors: () => void;

  session: StartedSession | null;
  isStarting: boolean;
  startError: string | null;
  start: (doctorId: string) => Promise<StartedSession | null>;

  code: string | null;
  isCompleting: boolean;
  completeError: string | null;
  complete: (data: QuestionnaireCompleteRequest) => Promise<string | null>;
}

/**
 * Сессия анкеты: список врачей, старт диалога и завершение.
 *
 * Ничего из ответов пациента здесь не сохраняется в браузерное хранилище:
 * жалобы вместе с именем и датой визита — сведения о здоровье, и по ТЗ
 * (допущение Д8) возврат к незавершённой анкете не предусмотрен.
 */
export const useQuestionnaireSession = (
  linkCode: string,
  /**
   * Нужен ли список врачей. По ссылке врача экран выбора пропускается, а при
   * терминальном состоянии показывается заглушка — в обоих случаях запрос
   * лишний. Эндпоинт публичный и попадает под лимиты обращений из ТЗ, так
   * что каждый ненужный запрос расходует их впустую.
   */
  needsDoctors: boolean,
): UseQuestionnaireSessionResult => {
  const [doctors, setDoctors] = useState<QuestionnaireDoctor[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  // Стартовое значение — `needsDoctors`, а не `false`: эффект запускается
  // только после монтирования, и при `false` первый кадр показывал бы
  // «Врачей не нашлось» вместо скелета — пустое состояние там, где
  // загрузка ещё даже не началась.
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(needsDoctors);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [doctorsAttempt, setDoctorsAttempt] = useState(0);

  const [session, setSession] = useState<StartedSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [code, setCode] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const isStartingRef = useRef(false);
  const isCompletingRef = useRef(false);

  useEffect(() => {
    if (!needsDoctors) {
      // Список перестал быть нужным — снимаем признак загрузки, иначе
      // скелет остался бы висеть навсегда.
      setIsLoadingDoctors(false);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setIsLoadingDoctors(true);
      setDoctorsError(null);

      try {
        const response = await mainApi.questionnaire.getDoctors(linkCode, {
          signal: controller.signal,
        });

        setDoctors(response.doctors);
        // Список с сервера задаёт единый порядок; если его нет — собираем
        // из карточек врачей.
        setSpecializations(
          response.specializations?.length
            ? response.specializations
            : collectSpecializations(response.doctors),
        );
      } catch (caught) {
        if (isAbortError(caught)) return;

        logError('Анкета: ошибка загрузки врачей', caught);
        setDoctorsError('Не удалось загрузить список врачей.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingDoctors(false);
      }
    };

    void load();

    return () => controller.abort();
  }, [linkCode, doctorsAttempt, needsDoctors]);

  const reloadDoctors = useCallback(() => {
    setDoctorsAttempt((attempt) => attempt + 1);
  }, []);

  const start = useCallback(
    async (doctorId: string): Promise<StartedSession | null> => {
      if (isStartingRef.current) return null;

      isStartingRef.current = true;
      setIsStarting(true);
      setStartError(null);

      try {
        const response = await mainApi.questionnaire.startSession({
          link_code: linkCode,
          doctor_id: doctorId,
        });

        const started: StartedSession = {
          sessionId: response.session_id,
          firstMessage: response.message,
        };
        setSession(started);
        return started;
      } catch (caught) {
        logError('Анкета: ошибка старта', caught);
        setStartError('Не удалось начать анкету. Попробуйте ещё раз.');
        return null;
      } finally {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    },
    [linkCode],
  );

  const complete = useCallback(
    async (data: QuestionnaireCompleteRequest): Promise<string | null> => {
      if (!session || isCompletingRef.current) return null;

      isCompletingRef.current = true;
      setIsCompleting(true);
      setCompleteError(null);

      try {
        const response = await mainApi.questionnaire.complete(
          session.sessionId,
          data,
        );

        setCode(response.code);
        return response.code;
      } catch (caught) {
        logError('Анкета: ошибка завершения', caught);
        setCompleteError('Не удалось сохранить данные. Попробуйте ещё раз.');
        return null;
      } finally {
        isCompletingRef.current = false;
        setIsCompleting(false);
      }
    },
    [session],
  );

  return {
    doctors,
    specializations,
    isLoadingDoctors,
    doctorsError,
    reloadDoctors,
    session,
    isStarting,
    startError,
    start,
    code,
    isCompleting,
    completeError,
    complete,
  };
};
