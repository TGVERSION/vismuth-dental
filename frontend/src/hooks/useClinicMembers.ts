'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mainApi,
  type ClinicInvitationCreated,
  type ClinicMemberInviteCreate,
  type ClinicMemberPatch,
  type ClinicMemberRead,
} from '@/api';
import { ApiError } from '@/api/base-client';
import { inviteErrorMessage } from '@/lib/clinics';
import { logWarn } from '@/lib/logger';

export type InviteResult =
  | { ok: true; invitation: ClinicInvitationCreated }
  | { ok: false; message: string };

/**
 * Сотрудники клиники и приглашения. Один источник и для блока
 * «Сотрудники», и для поля «Администраторы».
 */
export const useClinicMembers = (clinicId: string | null) => {
  const [members, setMembers] = useState<ClinicMemberRead[]>([]);
  const [loading, setLoading] = useState(clinicId !== null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const mountedRef = useRef(true);
  // Своя очередь на каждого сотрудника: правки одной строки не обгоняют
  // друг друга, а разные строки сохраняются независимо.
  const queuesRef = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!clinicId) return;

    let cancelled = false;
    mainApi.clinicMembers
      .list(clinicId)
      .then((data) => {
        if (cancelled) return;
        setMembers(data);
        setError(false);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logWarn('Не удалось загрузить сотрудников', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clinicId, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  /** Перечитать список без спиннера: раскрытые строки не сворачиваются. */
  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  /** Сохранить правку сотрудника. `true` — сохранено. */
  const patchMember = useCallback(
    (memberId: string, data: ClinicMemberPatch): Promise<boolean> => {
      if (!clinicId) return Promise.resolve(false);

      const previous = queuesRef.current.get(memberId) ?? Promise.resolve();
      const task = previous.then(async () => {
        try {
          const updated = await mainApi.clinicMembers.patch(
            clinicId,
            memberId,
            data,
          );
          if (mountedRef.current) {
            setMembers((prev) =>
              prev.map((member) => (member.id === memberId ? updated : member)),
            );
          }
          return true;
        } catch (err) {
          logWarn('Не удалось сохранить сотрудника', err);
          return false;
        }
      });

      queuesRef.current.set(memberId, task);
      return task;
    },
    [clinicId],
  );

  /** Отключить сотрудника; после успеха он пропадает из списка. */
  const deactivate = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!clinicId) return false;
      try {
        await mainApi.clinicMembers.deactivate(clinicId, memberId);
        if (mountedRef.current) {
          setMembers((prev) => prev.filter((member) => member.id !== memberId));
        }
        return true;
      } catch (err) {
        logWarn('Не удалось отключить сотрудника', err);
        return false;
      }
    },
    [clinicId],
  );

  const invite = useCallback(
    async (data: ClinicMemberInviteCreate): Promise<InviteResult> => {
      if (!clinicId) return { ok: false, message: 'Клиника ещё не создана' };
      try {
        const invitation = await mainApi.clinicMembers.invite(clinicId, data);
        if (mountedRef.current) refresh();
        return { ok: true, invitation };
      } catch (err) {
        logWarn('Не удалось отправить приглашение', err);
        const status = err instanceof ApiError ? err.status : undefined;
        const detail = err instanceof ApiError ? err.message : undefined;
        return { ok: false, message: inviteErrorMessage(status, detail) };
      }
    },
    [clinicId, refresh],
  );

  const resend = useCallback(
    async (invitationId: string): Promise<InviteResult> => {
      if (!clinicId) return { ok: false, message: 'Клиника ещё не создана' };
      try {
        const invitation = await mainApi.clinicMembers.resendInvitation(
          clinicId,
          invitationId,
        );
        return { ok: true, invitation };
      } catch (err) {
        logWarn('Не удалось отправить приглашение повторно', err);
        return { ok: false, message: 'Не удалось отправить приглашение' };
      }
    },
    [clinicId],
  );

  return {
    members,
    loading,
    error,
    reload,
    patchMember,
    deactivate,
    invite,
    resend,
  };
};
