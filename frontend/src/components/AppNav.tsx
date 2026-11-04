'use client';

import Link from 'next/link';
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
  const active = getActiveNavItem(usePathname());
  // Стоматологические анкеты видны регистратуре при включённой стоматологии;
  // пока клиника не загрузилась, раздела нет.
  const { clinic } = useMyClinic();
  const role = useAuthStore((state) => state.user?.role);
  const items = getNavItems({ showRegistry: canUseRegistry(clinic), role });

  return (
    <nav aria-label="Разделы" className="flex items-center gap-11">
      {items.map((item) =>
        item.id === active ? (
          <span key={item.id} aria-current="page" className="text-[#8B8B8B]">
            {item.label}
          </span>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="text-[#202020] transition-colors hover:text-[#5D8CF1]"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
};
