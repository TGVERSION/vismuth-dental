'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { mainApi, type ClinicRead } from '@/api';
import { logWarn } from '@/lib/logger';
import {
  EMPTY_CLINIC_DRAFT,
  clinicToDraft,
  nextClinicSave,
  type ClinicDraft,
  type ClinicField,
} from '@/lib/clinics';

type FieldErrors = Partial<Record<ClinicField, string>>;

/**
 * Карточка клиники с автосохранением.
 *
 * Все сохранения идут через одну очередь — строго по одному запросу. Так
 * клиника не создаётся дважды, а `PATCH` не обгоняют друг друга. Решение
 * «создать, патчить или ждать» принимается в момент выполнения задачи: к
 * этому времени клиника могла уже появиться.
 *
 * Ответ сервера обновляет только `saved`. Черновик из ответа не
 * перезаписывается — иначе затёрлось бы то, что пользователь ввёл, пока шёл
 * запрос.
 */
export const useClinicCard = (
  initialClinicId: string | null,
  onCreated?: (clinic: ClinicRead) => void,
) => {
  const [saved, setSaved] = useState<ClinicRead | null>(null);
  const [draft, setDraft] = useState<ClinicDraft>(EMPTY_CLINIC_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(initialClinicId !== null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const savedRef = useRef<ClinicRead | null>(null);
  const draftRef = useRef<ClinicDraft>(EMPTY_CLINIC_DRAFT);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  const onCreatedRef = useRef(onCreated);

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!initialClinicId) return;

    let cancelled = false;
    mainApi.clinics
      .get(initialClinicId)
      .then((clinic) => {
        if (cancelled) return;
        const next = clinicToDraft(clinic);
        savedRef.current = clinic;
        draftRef.current = next;
        setSaved(clinic);
        setDraft(next);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logWarn('Не удалось загрузить клинику', error);
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialClinicId, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    setReloadKey((key) => key + 1);
  }, []);

  const setFieldError = (field: ClinicField, error: string | null) => {
    setErrors((prev) => {
      if ((prev[field] ?? null) === error) return prev;
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  /** Поставить задачу в очередь. Ошибка задачи не рвёт цепочку. */
  const enqueue = useCallback((task: () => Promise<void>) => {
    setPending((count) => count + 1);
    queueRef.current = queueRef.current
      .then(task)
      .catch((error: unknown) => {
        logWarn('Ошибка в очереди сохранения клиники', error);
      })
      .finally(() => {
        if (mountedRef.current) setPending((count) => count - 1);
      });
  }, []);

  const commitField = useCallback(
    (field: ClinicField) => {
      enqueue(async () => {
        const decision = nextClinicSave(
          savedRef.current,
          draftRef.current,
          field,
        );

        if (decision.kind === 'invalid') {
          if (mountedRef.current) setFieldError(field, decision.error);
          return;
        }
        if (decision.kind === 'wait' || decision.kind === 'skip') {
          if (mountedRef.current) setFieldError(field, null);
          return;
        }

        try {
          const clinic =
            decision.kind === 'create'
              ? await mainApi.clinics.create(decision.data)
              : await mainApi.clinics.patch(
                  savedRef.current!.id,
                  decision.data,
                );

          savedRef.current = clinic;
          if (!mountedRef.current) return;
          setSaved(clinic);
          setFieldError(field, null);
          if (decision.kind === 'create') onCreatedRef.current?.(clinic);
        } catch (error) {
          logWarn('Не удалось сохранить клинику', error);
          if (!mountedRef.current) return;
          setFieldError(field, 'Не сохранено');
          if (decision.kind === 'create') {
            toast.error('Не удалось создать клинику');
          }
        }
      });
    },
    [enqueue],
  );

  const setField = useCallback(
    <K extends ClinicField>(field: K, value: ClinicDraft[K]) => {
      draftRef.current = { ...draftRef.current, [field]: value };
      setDraft(draftRef.current);
    },
    [],
  );

  /** Для списков и даты: выбор сразу сохраняется. */
  const setAndCommit = useCallback(
    <K extends ClinicField>(field: K, value: ClinicDraft[K]) => {
      setField(field, value);
      commitField(field);
    },
    [setField, commitField],
  );

  /**
   * Перечитать карточку после изменений состава сотрудников
   * (`doctors_count`). Через очередь — чтобы не обогнать идущий `PATCH`.
   * Черновик не трогается.
   */
  const refreshSaved = useCallback(() => {
    enqueue(async () => {
      const id = savedRef.current?.id;
      if (!id) return;
      const clinic = await mainApi.clinics.get(id);
      savedRef.current = clinic;
      if (mountedRef.current) setSaved(clinic);
    });
  }, [enqueue]);

  return {
    saved,
    draft,
    errors,
    isSaving: pending > 0,
    loading,
    loadError,
    reload,
    setField,
    commitField,
    setAndCommit,
    refreshSaved,
  };
};
