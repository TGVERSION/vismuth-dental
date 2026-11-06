'use client';
import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from '@/api/base-client';
import { clinicJoinApi } from '@/api/clinic-join-api';
import { useAuthStore } from '@/store/authStore';
import { JoinStatus } from './JoinStatus';
export function ClinicAccessGate({ children }: { children: React.ReactNode }) {
  const identity = useAuthStore(
    (s) => s.user?.id ?? s.user?.login ?? 'anonymous',
  );
  return <AccountGate key={identity}>{children}</AccountGate>;
}
function AccountGate({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<
    'loading' | 'restricted' | 'allowed' | 'error'
  >('loading');
  const check = useCallback(() => {
    const controller = new AbortController();
    clinicJoinApi
      .me({ signal: controller.signal })
      .then((r) => setAccess(r.restricted ? 'restricted' : 'allowed'))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setAccess('error');
      });
    return () => controller.abort();
  }, []);
  const allow = useCallback(() => setAccess('allowed'), []);
  useEffect(check, [check]);
  if (access === 'loading')
    return (
      <p role="status" className="m-auto p-16">
        Проверка доступа…
      </p>
    );
  if (access === 'restricted') return <JoinStatus onAllowed={allow} />;
  if (access === 'error')
    return (
      <div className="m-auto p-16">
        <p role="alert">Не удалось проверить доступ</p>
        <button onClick={check} className="text-[#5D8CF1]">
          Повторить
        </button>
      </div>
    );
  return <>{children}</>;
}
