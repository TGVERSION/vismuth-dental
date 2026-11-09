'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clinicJoinApi } from '@/api/clinic-join-api';
import { usePathname } from 'next/navigation';
import { useMyClinic } from '@/hooks/useMyClinic';
import { canUseRegistry, getActiveNavItem, getNavItems } from '@/lib/app-nav';
import { useAuthStore } from '@/store/authStore';

/**
 * Разделы в шапке защищённой зоны.
 *
 * Активный раздел — серым, остальные — тёмным, как на макете.
 *
 * Активный пункт намеренно не ссылка. Экран протокола живёт на
 * `/?id=…&structure_id=…`, и переход по `href="/"` стёр бы параметры: протокол
 * остался бы на экране, но после обновления страницы уже не открылся бы.
 *
 * Уход с экрана протокола по ссылке безопасен: несохранённые правки
 * досохраняет `useProtocolDraft` при размонтировании экрана.
 */
export const AppNav = () => {
  const pathname = usePathname();
  const active = getActiveNavItem(pathname);
  // Стоматологические анкеты видны регистратуре при включённой стоматологии;
  // пока клиника не загрузилась, раздела нет.
  const { clinic } = useMyClinic();
  const role = useAuthStore((state) => state.user?.role);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (role !== 'super_admin') return;
    let live = true;
    const reload = () => {
      if (document.visibilityState === 'visible')
        clinicJoinApi
          .requests({ status: 'pending', page_size: 1 })
          .then((r) => {
            if (live) setPending(r.total);
          })
          .catch(() => {});
    };
    reload();
    const timer = setInterval(reload, 30000);
    document.addEventListener('visibilitychange', reload);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [role, pathname]);
  const base = getNavItems({
    showRegistry: role === 'super_admin' || canUseRegistry(clinic),
    role,
    isDoctor: clinic?.is_doctor === true,
  });
  const items =
    role === 'super_admin'
      ? base.map((item) =>
          item.id === 'requests' && pending
            ? { ...item, label: 'Заявки (' + pending + ')' }
            : item,
        )
      : [
          ...base.filter(
            (i) =>
              !(
                (clinic?.is_operator || clinic?.is_clinic_admin) &&
                !clinic.is_doctor &&
                i.id === 'questionnaires'
              ),
          ),
          ...((clinic?.is_operator || clinic?.is_clinic_admin) &&
          !clinic.is_doctor
            ? [
                {
                  id: 'completed',
                  label: 'Заполненные анкеты',
                  href: '/completed-questionnaires',
                },
              ]
            : []),
        ];

  return (
    <nav aria-label="Разделы" className="flex w-max items-center gap-5 px-3">
      {items.map((item) =>
        item.id === active ? (
          <span
            key={item.id}
            aria-current="page"
            className="text-[var(--ui-color-alabaster-950)]"
          >
            {item.label}
          </span>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="text-[var(--ui-color-alabaster-dark-800)] transition-colors hover:text-[var(--ui-color-blue-600)]"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
};
