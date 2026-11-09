'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { mainApi, type ProtocolStructuresFields } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { type LocalField } from './field-model';
import {
  matchesStructureWrite,
  type StructureWriteExpectation,
} from './structure-recovery';
import {
  structureFieldsPayload,
  type SavedFieldIdentity,
} from './structure-payload';

interface Draft {
  name: string;
  fields: LocalField[];
}

type Status = 'saved' | 'pending' | 'saving' | 'error' | 'invalid';
const snapshot = (draft: Draft) => JSON.stringify(draft);

/** Один последовательный цикл: ответ сервера подтверждает только отправленную версию. */
export function useStructureAutosave(draft: Draft, enabled: boolean) {
  const [status, setStatus] = useState<Status>('saved');
  const [savedData, setSavedData] = useState(() => snapshot(draft));
  const latest = useRef(draft);
  const active = useRef(enabled);
  useLayoutEffect(() => {
    latest.current = draft;
    active.current = enabled;
  }, [draft, enabled]);
  const savedSnapshot = useRef(snapshot(draft));
  const metadata = useRef({ id: '', code: '', version: 0 });
  const identities = useRef(new Map<string, SavedFieldIdentity>());
  const savedFields = useRef(new Map<string, string>());
  const serverRecord = useRef<ProtocolStructuresFields | null>(null);
  const pendingWrite = useRef<{
    expected: StructureWriteExpectation;
    baseline: ProtocolStructuresFields | null;
    sent: string;
    fields: ReturnType<typeof structureFieldsPayload>;
    write: () => Promise<ProtocolStructuresFields>;
  } | null>(null);
  const cycle = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialize = useCallback(
    (record: ProtocolStructuresFields | null, next: Draft) => {
      serverRecord.current = record;
      pendingWrite.current = null;
      metadata.current = {
        id: record?.id || '',
        code: record?.structure_code || '',
        version: record?.version || 0,
      };
      identities.current = new Map(
        next.fields.flatMap((f) =>
          f.id ? [[f.localId, { id: f.id, name: f.field_name }]] : [],
        ),
      );
      savedFields.current = new Map(
        structureFieldsPayload(next.fields, identities.current).map((f) => [
          f.localId,
          JSON.stringify(f.field),
        ]),
      );
      savedSnapshot.current = snapshot(next);
      setSavedData(snapshot(next));
      latest.current = next;
      setStatus('saved');
    },
    [],
  );

  const saveNow = useCallback((): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (cycle.current) return cycle.current;
    if (
      !pendingWrite.current &&
      snapshot(latest.current) === savedSnapshot.current
    )
      return Promise.resolve(true);
    const run = (async () => {
      try {
        type Attempt = NonNullable<typeof pendingWrite.current>;
        const recover = async (attempt: Attempt) => {
          const expected = attempt.expected;
          if (useAuthStore.getState().user?.id !== expected.creator_id)
            throw new Error('Учётная запись изменилась');
          let id = expected.id;
          if (!id) {
            const candidates = (
              await mainApi.protocol_structures.getProtocolStructures()
            ).filter(
              (record) =>
                record.creator_id === expected.creator_id &&
                record.structure_code === expected.structure_code,
            );
            if (!candidates.length) return { committed: null, canRetry: true };
            if (candidates.length !== 1)
              return { committed: null, canRetry: false };
            id = candidates[0].id;
          }
          const record =
            await mainApi.protocol_structures.getProtocolStructuresById(id);
          return {
            committed: matchesStructureWrite(record, expected) ? record : null,
            canRetry:
              !!attempt.baseline &&
              matchesStructureWrite(record, attempt.baseline),
          };
        };
        const acknowledge = (
          saved: ProtocolStructuresFields,
          attempt: Attempt,
        ) => {
          if (useAuthStore.getState().user?.id !== attempt.expected.creator_id)
            throw new Error('Учётная запись изменилась');
          serverRecord.current = saved;
          metadata.current = {
            id: saved.id,
            code: saved.structure_code,
            version: saved.version,
          };
          identities.current = new Map(
            attempt.fields.flatMap((f) => {
              const server = saved.fields.find(
                (item) => item.field_name === f.field.field_name,
              );
              return server
                ? [[f.localId, { id: server.id, name: server.field_name }]]
                : [];
            }),
          );
          savedSnapshot.current = attempt.sent;
          setSavedData(attempt.sent);
          savedFields.current = new Map(
            attempt.fields.map((f) => [f.localId, JSON.stringify(f.field)]),
          );
          pendingWrite.current = null;
        };
        const perform = async (attempt: Attempt) => {
          if (useAuthStore.getState().user?.id !== attempt.expected.creator_id)
            throw new Error('Учётная запись изменилась');
          try {
            const saved = await attempt.write();
            if (!matchesStructureWrite(saved, attempt.expected))
              throw new Error('Ответ сервера не подтверждает изменения');
            return saved;
          } catch (error) {
            const recovered = await recover(attempt);
            if (recovered.committed) return recovered.committed;
            throw error;
          }
        };
        // Перед повтором читаем сервер: принимаем точный результат либо
        // повторяем ту же операцию только при неизменившемся исходном состоянии.
        if (pendingWrite.current) {
          const attempt = pendingWrite.current;
          const recovered = await recover(attempt);
          if (recovered.committed) acknowledge(recovered.committed, attempt);
          else if (recovered.canRetry)
            acknowledge(await perform(attempt), attempt);
          else
            throw new Error('Результат предыдущего изменения не подтверждён');
        }
        while (snapshot(latest.current) !== savedSnapshot.current) {
          const current = latest.current;
          if (!current.name.trim()) {
            setStatus('invalid');
            return false;
          }
          const ownerId = useAuthStore.getState().user?.id;
          if (!ownerId) throw new Error('Нет учётной записи');
          const sent = snapshot(current);
          const fields = structureFieldsPayload(
            current.fields,
            identities.current,
          );
          const meta = metadata.current;
          if (!meta.code)
            meta.code = `structure_${crypto.randomUUID().replaceAll('-', '')}`;
          const changed = (f: (typeof fields)[number]) =>
            !f.id ||
            savedFields.current.get(f.localId) !== JSON.stringify(f.field);
          const expected: StructureWriteExpectation = {
            id: meta.id || undefined,
            creator_id: ownerId,
            structure_code: meta.code,
            structure_name: current.name.trim(),
            version: meta.version + 1,
            description: serverRecord.current?.description ?? null,
            is_active: serverRecord.current?.is_active ?? true,
            fields: fields.map((f) => {
              const previous = serverRecord.current?.fields.find(
                (item) => item.id === f.id,
              );
              return changed(f)
                ? { ...previous, ...f.field, id: f.id }
                : previous || f.field;
            }),
          };
          const keptIds = new Set(fields.flatMap((f) => (f.id ? [f.id] : [])));
          const patchBody = {
            structure_name: expected.structure_name,
            version: expected.version,
            fields_add: fields.filter((f) => !f.id).map((f) => f.field),
            fields_update: fields.flatMap((f) =>
              f.id && changed(f) ? [{ id: f.id, ...f.field }] : [],
            ),
            fields_delete: [...identities.current.values()]
              .filter((f) => !keptIds.has(f.id))
              .map((f) => f.id),
          };
          const postBody = {
            structure_code: meta.code,
            structure_name: expected.structure_name,
            version: expected.version,
            is_active: true,
            fields: fields.map((f) => f.field),
          };
          const attempt: Attempt = {
            expected,
            baseline: serverRecord.current,
            sent,
            fields,
            write: () =>
              expected.id
                ? mainApi.protocol_structures.patchProtocolStructuresById(
                    expected.id,
                    patchBody,
                  )
                : mainApi.protocol_structures.postProtocolStructures(postBody),
          };
          pendingWrite.current = attempt;
          setStatus('saving');
          acknowledge(await perform(attempt), attempt);
        }
        setStatus('saved');
        return true;
      } catch {
        setStatus('error');
        return false;
      }
    })();
    cycle.current = run;
    void run.finally(() => {
      cycle.current = null;
    });
    return run;
  }, []);

  const serialized = snapshot(draft);
  useEffect(() => {
    if (
      !enabled ||
      (!pendingWrite.current && serialized === savedSnapshot.current)
    )
      return;
    timer.current = setTimeout(() => {
      void saveNow();
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [serialized, enabled, draft.name, saveNow]);

  useEffect(() => {
    if (!enabled || status !== 'error') return;
    const retry = () => {
      void saveNow();
    };
    const interval = setInterval(retry, 15000);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', retry);
    };
  }, [enabled, status, saveNow]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        !active.current ||
        (!pendingWrite.current &&
          snapshot(latest.current) === savedSnapshot.current)
      )
        return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (active.current && useAuthStore.getState().accessToken) void saveNow();
    },
    [saveNow],
  );

  const visibleStatus =
    (status === 'saved' || status === 'invalid') && serialized !== savedData
      ? draft.name.trim()
        ? 'pending'
        : 'invalid'
      : status;
  const discardChanges = useCallback((): Draft => {
    if (timer.current) clearTimeout(timer.current);
    pendingWrite.current = null;
    const restored = JSON.parse(savedSnapshot.current) as Draft;
    latest.current = restored;
    setStatus('saved');
    return restored;
  }, []);
  return { status: visibleStatus, initialize, saveNow, discardChanges };
}
