'use client';

// Состояние помощника «Обоснование для ДМС» на экране протокола: запрос,
// ожидание, предложения по разделам и отказы. Решения о том, что отправить и
// как читать ответ, — в src/lib/dms-justification.ts.
//
// Предложение живёт здесь, отдельно от разделов формы: пока врач не нажал
// «Принять», текст помощника не попадает ни в форму, ни в автосохранение.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logError } from '@/lib/logger';
import type { DraftSection } from '@/lib/protocol-draft';
import {
  buildDmsRequest,
  classifyDmsError,
  DMS_NOTHING_TO_ADD_MESSAGE,
  DMS_STEPS,
  dmsStepAt,
  extractMkbCode,
  mapDmsResponse,
  noGuidelineText,
  type DmsFailure,
  type DmsNoGuidelineText,
} from '@/lib/dms-justification';

export type DmsPhase =
  | 'idle'
  | 'loading'
  | 'review'
  | 'error'
  | 'nofound'
  | 'unavailable';

export interface DmsReviewItem {
  sectionId: number;
  /** Текст раздела в момент запуска — «Было». */
  original: string;
  /** Ответ помощника без правок врача. */
  proposal: string;
  /** Текст, который врач видит и правит; его записывает «Принять». */
  draft: string;
}

interface DmsState {
  phase: DmsPhase;
  step: number;
  diagnosisCode: string | null;
  /** Разделы, отправленные помощнику: у них ожидание и ошибка. */
  targetIds: number[];
  /** Разделы, ждущие решения врача. */
  items: Record<number, DmsReviewItem>;
  failure: Extract<DmsFailure, { kind: 'error' | 'unavailable' }> | null;
  noGuideline: DmsNoGuidelineText | null;
}

const IDLE: DmsState = {
  phase: 'idle',
  step: 0,
  diagnosisCode: null,
  targetIds: [],
  items: {},
  failure: null,
  noGuideline: null,
};

const STEP_TICK_MS = 1000;

interface Run {
  /** Номер запуска: ответ устаревшего запуска не применяется. */
  id: number;
  controller: AbortController | null;
  timer: ReturnType<typeof setInterval> | null;
}

export const useDmsJustification = (protocolId: string | null) => {
  const [state, setState] = useState<DmsState>(IDLE);

  // Предложения относятся к одному протоколу. При переходе к другому
  // состояние сбрасывается сразу, в рендере, — иначе на мгновение мелькнуло
  // бы чужое предложение, а возврат к прежнему протоколу его бы воскресил.
  const [stateProtocolId, setStateProtocolId] = useState(protocolId);
  if (stateProtocolId !== protocolId) {
    setStateProtocolId(protocolId);
    setState(IDLE);
  }

  const runRef = useRef<Run>({ id: 0, controller: null, timer: null });

  // Смена протокола и размонтирование отменяют запрос и останавливают
  // таймер шагов.
  useEffect(() => {
    const run = runRef.current;
    return () => {
      run.id += 1;
      run.controller?.abort();
      run.controller = null;
      if (run.timer) clearInterval(run.timer);
      run.timer = null;
    };
  }, [protocolId]);

  /**
   * Запуск. Возвращает фазу, в которой закончился запрос, или `null`, если
   * запуска не было или его отменили.
   */
  const start = useCallback(
    async (sections: DraftSection[]): Promise<DmsPhase | null> => {
      const run = runRef.current;
      if (run.controller) return null;

      const request = buildDmsRequest(sections);
      if (!request) return null;

      const id = ++run.id;
      const controller = new AbortController();
      run.controller = controller;
      const targetIds = request.sections.map((section) => Number(section.key));

      setState({
        ...IDLE,
        phase: 'loading',
        diagnosisCode: extractMkbCode(request.main_diagnosis),
        targetIds,
      });

      const startedAt = Date.now();
      run.timer = setInterval(() => {
        if (run.id !== id) return;
        const step = dmsStepAt(Date.now() - startedAt);
        setState((prev) => (prev.step === step ? prev : { ...prev, step }));
      }, STEP_TICK_MS);

      try {
        const response = await mainApi.ml_handlers.ml_clinrec_dms(request, {
          signal: controller.signal,
        });
        if (run.id !== id) return null;

        const proposals = mapDmsResponse(request, response);
        if (proposals.length === 0) {
          setState(IDLE);
          toast.info(DMS_NOTHING_TO_ADD_MESSAGE, {
            toastId: 'dms-nothing-to-add',
          });
          return 'idle';
        }

        setState({
          ...IDLE,
          phase: 'review',
          targetIds,
          items: Object.fromEntries(
            proposals.map((proposal) => [
              proposal.sectionId,
              { ...proposal, draft: proposal.proposal },
            ]),
          ),
        });
        return 'review';
      } catch (error) {
        // Отмена — не ошибка: врач ушёл в другой протокол.
        if (isAbortError(error) || run.id !== id) return null;

        // В лог — только статус и код: тело ответа может содержать текст
        // протокола.
        const info =
          error instanceof ApiError
            ? { status: error.status, code: error.code }
            : null;
        logError('Обоснование для ДМС: запрос не выполнен', info);

        const failure = classifyDmsError(info);
        if (failure.kind === 'nofound') {
          setState({
            ...IDLE,
            phase: 'nofound',
            noGuideline: noGuidelineText(
              failure.reason,
              request.main_diagnosis,
            ),
          });
          return 'nofound';
        }

        setState({ ...IDLE, phase: failure.kind, targetIds, failure });
        return failure.kind;
      } finally {
        if (run.id === id) {
          run.controller = null;
          if (run.timer) clearInterval(run.timer);
          run.timer = null;
        }
      }
    },
    [],
  );

  const finishItem = useCallback((sectionId: number) => {
    setState((prev) => {
      if (!prev.items[sectionId]) return prev;
      const items = { ...prev.items };
      delete items[sectionId];
      return Object.keys(items).length > 0 ? { ...prev, items } : IDLE;
    });
  }, []);

  const setDraft = useCallback((sectionId: number, draft: string) => {
    setState((prev) => {
      const item = prev.items[sectionId];
      if (!item) return prev;
      return {
        ...prev,
        items: { ...prev.items, [sectionId]: { ...item, draft } },
      };
    });
  }, []);

  /**
   * Принять предложение. Возвращает текст для раздела или `null`, если
   * принимать нечего: пустой текст стёр бы раздел одним нажатием.
   */
  const accept = useCallback(
    (sectionId: number): string | null => {
      const item = state.items[sectionId];
      if (!item || !item.draft.trim()) return null;
      finishItem(sectionId);
      return item.draft;
    },
    [state.items, finishItem],
  );

  /** «Оставить как было»: раздел не меняется. */
  const keep = useCallback(
    (sectionId: number) => finishItem(sectionId),
    [finishItem],
  );

  const dismissNoGuideline = useCallback(() => {
    setState((prev) => (prev.phase === 'nofound' ? IDLE : prev));
  }, []);

  const firstStep = DMS_STEPS[0].text;
  const stepText =
    state.step === 0 && state.diagnosisCode
      ? `${firstStep} ${state.diagnosisCode}`
      : DMS_STEPS[state.step].text;

  return {
    phase: state.phase,
    stepText,
    targetIds: state.targetIds,
    items: state.items,
    failure: state.failure,
    noGuideline: state.noGuideline,
    /** Пока помощник работает, протокол не редактируется. */
    isLocked: state.phase === 'loading',
    /** Есть разделы, ждущие решения врача. */
    hasPendingReview: Object.keys(state.items).length > 0,
    start,
    setDraft,
    accept,
    keep,
    dismissNoGuideline,
  };
};
