'use client';

// Состояние помощника «Проверка для ДМС» на экране протокола: запросы,
// ожидание, отметки по разделам и отказы. Решения о том, что отправить и
// как читать ответ, — в src/lib/dms-check.ts.
//
// Отметки живут здесь, отдельно от разделов формы: пока врач не нажал
// «Убрать отмеченное», текст раздела не меняется ни в форме, ни в
// автосохранении.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import { ApiError, isAbortError } from '@/api/base-client';
import { logError } from '@/lib/logger';
import type { DraftSection } from '@/lib/protocol-draft';
import {
  buildDmsPlan,
  classifyDmsError,
  DMS_ALL_CONFIRMED_MESSAGE,
  DMS_STEPS,
  dmsRequestFor,
  dmsStepAt,
  extractMkbCode,
  findTooLongTarget,
  mapDmsResponse,
  noGuidelineText,
  tooLongMessage,
  type DmsFailure,
  type DmsFinding,
  type DmsNoGuidelineText,
} from '@/lib/dms-check';

export type DmsPhase =
  | 'idle'
  | 'loading'
  | 'review'
  | 'error'
  | 'nofound'
  | 'unavailable';

interface DmsState {
  phase: DmsPhase;
  step: number;
  diagnosisCode: string | null;
  /** Разделы, отправленные на проверку: у них ожидание и ошибка. */
  targetIds: number[];
  /** Разделы с отмеченными назначениями, ждущие решения врача. */
  items: Record<number, DmsFinding>;
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

export const useDmsCheck = (protocolId: string | null) => {
  const [state, setState] = useState<DmsState>(IDLE);

  // Отметки относятся к одному протоколу. При переходе к другому состояние
  // сбрасывается сразу, в рендере, — иначе на мгновение мелькнули бы чужие
  // отметки, а возврат к прежнему протоколу их бы воскресил.
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
   * Запуск. Возвращает фазу, в которой закончилась проверка, или `null`,
   * если запуска не было или его отменили.
   */
  const start = useCallback(
    async (sections: DraftSection[]): Promise<DmsPhase | null> => {
      const run = runRef.current;
      if (run.controller) return null;

      const plan = buildDmsPlan(sections);
      if (!plan) return null;

      const tooLong = findTooLongTarget(plan);
      if (tooLong) {
        setState({
          ...IDLE,
          phase: 'unavailable',
          targetIds: [tooLong.sectionId],
          failure: {
            kind: 'unavailable',
            message: tooLongMessage(tooLong.label),
          },
        });
        return 'unavailable';
      }

      const id = ++run.id;
      const controller = new AbortController();
      run.controller = controller;
      const targetIds = plan.targets.map((target) => target.sectionId);

      setState({
        ...IDLE,
        phase: 'loading',
        diagnosisCode: extractMkbCode(plan.mkb),
        targetIds,
      });

      const startedAt = Date.now();
      run.timer = setInterval(() => {
        if (run.id !== id) return;
        const step = dmsStepAt(Date.now() - startedAt);
        setState((prev) => (prev.step === step ? prev : { ...prev, step }));
      }, STEP_TICK_MS);

      try {
        // Разделы проверяются по очереди: backend принимает один текст
        // назначений, а клинрек после первого запроса уже разобран.
        const findings: DmsFinding[] = [];
        for (const target of plan.targets) {
          const response = await mainApi.ml_handlers.check_dms(
            dmsRequestFor(plan, target),
            { signal: controller.signal },
          );
          if (run.id !== id) return null;
          const finding = mapDmsResponse(target, response);
          if (finding) findings.push(finding);
        }

        if (findings.length === 0) {
          setState(IDLE);
          toast.info(DMS_ALL_CONFIRMED_MESSAGE, {
            toastId: 'dms-all-confirmed',
          });
          return 'idle';
        }

        setState({
          ...IDLE,
          phase: 'review',
          targetIds,
          items: Object.fromEntries(
            findings.map((finding) => [finding.sectionId, finding]),
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
        logError('Проверка для ДМС: запрос не выполнен', info);

        const failure = classifyDmsError(info);
        if (failure.kind === 'nofound') {
          setState({
            ...IDLE,
            phase: 'nofound',
            noGuideline: noGuidelineText(failure.reason, plan.mkb),
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

  /**
   * «Убрать отмеченное». Возвращает новый текст раздела или `null`, если
   * для раздела нет отметок.
   */
  const accept = useCallback(
    (sectionId: number): string | null => {
      const item = state.items[sectionId];
      if (!item) return null;
      finishItem(sectionId);
      return item.cleaned;
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
    /** Пока идёт проверка, протокол не редактируется. */
    isLocked: state.phase === 'loading',
    /** Есть разделы, ждущие решения врача. */
    hasPendingReview: Object.keys(state.items).length > 0,
    start,
    accept,
    keep,
    dismissNoGuideline,
  };
};
