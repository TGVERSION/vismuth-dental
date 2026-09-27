'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { mainApi, type ProtocolsPatch } from '@/api';
import { logError } from '@/lib/logger';
import {
  buildFieldValues,
  computeChangedValues,
  isFieldMappingBroken,
  serializeDraft,
  type DraftSection,
} from '@/lib/protocol-draft';

const DEBOUNCE_MS = 600;
const RETRY_INTERVAL_MS = 15000;

interface UseProtocolDraftOptions {
  protocolId: string | null;
  title: string;
  sections: DraftSection[];
  /** Идёт загрузка протокола: автосохранение в это время не запускается. */
  isLoading: boolean;
}

/**
 * Автосохранение черновика протокола.
 *
 * Ключевое свойство: данные считаются сохранёнными **только** после успешного
 * ответа сервера и только тем содержимым, которое действительно ушло. Прежняя
 * реализация помечала правки сохранёнными и при тихом выходе из-за занятого
 * слота — врач терял текст, а индикатор показывал «сохранено».
 */
export const useProtocolDraft = ({
  protocolId,
  title,
  sections,
  isLoading,
}: UseProtocolDraftOptions) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSavedData, setLastSavedData] = useState('');

  // Актуальный черновик в ref: цикл сохранения должен отправлять последнее
  // состояние, а не то, что было на момент его запуска.
  const draftRef = useRef<{ title: string; sections: DraftSection[] }>({
    title,
    sections,
  });
  const protocolIdRef = useRef<string | null>(null);
  const savePendingRef = useRef(false);
  const saveCycleRef = useRef<Promise<boolean> | null>(null);
  const saveFailedRef = useRef(false);
  const lastSavedRef = useRef('');
  // Последнее состояние, подтверждённое сервером: нужно, чтобы отправлять
  // только изменившиеся поля.
  const lastSavedValuesRef = useRef<Record<string, string>>({});
  const lastSavedTitleRef = useRef('');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    draftRef.current = { title, sections };
  }, [title, sections]);

  useEffect(() => {
    protocolIdRef.current = protocolId;
  }, [protocolId]);

  useEffect(() => {
    lastSavedRef.current = lastSavedData;
  }, [lastSavedData]);

  /**
   * Зафиксировать состояние как сохранённое: после загрузки протокола с
   * сервера или сразу после его создания. Без этого автосохранение отправляло
   * бы обратно только что прочитанные данные.
   */
  const resetBaseline = useCallback(
    (baseTitle: string, baseSections: DraftSection[]) => {
      draftRef.current = { title: baseTitle, sections: baseSections };
      lastSavedValuesRef.current = buildFieldValues(baseSections);
      lastSavedTitleRef.current = baseTitle;
      setLastSavedData(serializeDraft(baseTitle, baseSections));
      saveFailedRef.current = false;
      setSaveFailed(false);
    },
    [],
  );

  /** Снять отложенное сохранение: например, при уходе на другой протокол. */
  const cancelPending = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    savePendingRef.current = false;
  }, []);

  // Отправка черновика. Используется PATCH с одними лишь изменившимися полями,
  // а не PUT со всем протоколом: backend валидирует обязательные поля и на PUT,
  // и на POST, невзирая на статус «черновик». При PUT со всеми полями ввод в
  // один раздел не сохранялся из-за пустоты другого.
  const sendDraft = useCallback(async () => {
    const id = protocolIdRef.current;
    if (!id) return;

    const { title: draftTitle, sections: draftSections } = draftRef.current;
    const snapshot = serializeDraft(draftTitle, draftSections);
    const fieldValues = buildFieldValues(draftSections);

    if (isFieldMappingBroken(draftSections, fieldValues)) {
      throw new Error('Поля протокола не сопоставлены со структурой');
    }

    const changedValues = computeChangedValues(
      fieldValues,
      lastSavedValuesRef.current,
    );
    const titleChanged = draftTitle !== lastSavedTitleRef.current;

    if (!titleChanged && Object.keys(changedValues).length === 0) {
      // Отличается только то, что сервера не касается. Запрос не нужен.
      setLastSavedData(snapshot);
      return;
    }

    const payload: ProtocolsPatch = {};
    if (titleChanged) payload.protocol_name = draftTitle;
    if (Object.keys(changedValues).length > 0) {
      payload.field_values = changedValues;
    }

    await mainApi.protocols.patchProtocolsById(id, payload);

    lastSavedValuesRef.current = {
      ...lastSavedValuesRef.current,
      ...changedValues,
    };
    lastSavedTitleRef.current = draftTitle;
    setLastSavedData(snapshot);
  }, []);

  // Единая точка сохранения. Если запрос уже выполняется, правки не теряются:
  // они помечаются отложенными и уходят следующей итерацией цикла.
  const saveNow = useCallback((): Promise<boolean> => {
    if (!protocolIdRef.current) return Promise.resolve(false);

    savePendingRef.current = true;
    if (saveCycleRef.current) return saveCycleRef.current;

    const cycle = (async () => {
      setIsSaving(true);
      let ok = true;
      try {
        while (savePendingRef.current) {
          savePendingRef.current = false;
          await sendDraft();
        }
        saveFailedRef.current = false;
        setSaveFailed(false);
      } catch (error) {
        ok = false;
        // Правки остались неотправленными — снимок сохранённого состояния
        // не трогаем, следующая попытка отправит их заново.
        savePendingRef.current = true;
        logError('Ошибка сохранения протокола:', error);
        // Тост только на первом сбое: дальше о состоянии сообщает индикатор,
        // иначе автоповтор засыпал бы врача одинаковыми уведомлениями.
        if (!saveFailedRef.current) {
          toast.error('Не удалось сохранить протокол');
        }
        saveFailedRef.current = true;
        setSaveFailed(true);
      } finally {
        setIsSaving(false);
        saveCycleRef.current = null;
      }
      return ok;
    })();

    saveCycleRef.current = cycle;
    return cycle;
  }, [sendDraft]);

  /**
   * Досохранить то, что ещё висит в дебаунсе. Вызывается перед уходом с
   * протокола: отложенные правки надо отправить до переключения, иначе они
   * пропадут вместе со сброшенным таймером.
   */
  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!protocolIdRef.current) return;

    const { title: draftTitle, sections: draftSections } = draftRef.current;
    if (serializeDraft(draftTitle, draftSections) === lastSavedRef.current) {
      return;
    }

    await saveNow();
  }, [saveNow]);

  const currentSnapshot = useMemo(
    () => serializeDraft(title, sections),
    [title, sections],
  );

  const hasUnsavedChanges =
    !!protocolId && !isLoading && currentSnapshot !== lastSavedData;

  useEffect(() => {
    if (!protocolId || isLoading) return;
    if (currentSnapshot === lastSavedData) return;

    saveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [currentSnapshot, lastSavedData, protocolId, isLoading, saveNow]);

  // Автоповтор после сбоя: связь могла восстановиться, пока врач продолжал
  // работать. Прекращается сам, как только сохранение прошло успешно.
  useEffect(() => {
    if (!saveFailed || !hasUnsavedChanges) return;

    const retryTimer = setInterval(() => {
      void saveNow();
    }, RETRY_INTERVAL_MS);

    return () => clearInterval(retryTimer);
  }, [saveFailed, hasUnsavedChanges, saveNow]);

  // Предупреждаем о несохранённых правках при закрытии вкладки.
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  return {
    isSaving,
    saveFailed,
    hasUnsavedChanges,
    saveNow,
    flushPendingSave,
    resetBaseline,
    cancelPending,
  };
};
