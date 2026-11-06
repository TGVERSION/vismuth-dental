'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshCurrentUser } from '@/hooks/useRefreshCurrentUser';
import { DoctorsHelpers } from '@/components/DoctorsHelpers';
import { SettingsPopup } from '@/components/settings/SettingsPopup';
import { ClinicAccessGate } from '@/components/clinic-join/ClinicAccessGate';
import { useMyClinic } from '@/hooks/useMyClinic';
import { operatorOnly } from '@/lib/clinic-access';
import { AppNav } from '@/components/AppNav';

function WorkingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { clinic, isLoading: isClinicLoading } = useMyClinic();
  const router = useRouter();
  const hideTools = operatorOnly(clinic);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user, handleLogout } = useAuth();
  useRefreshCurrentUser();
  const hideHeader = ['/login', '/register'].includes(pathname);
  const [showDoctorsHelpers, setShowDoctorsHelpers] = useState(false);
  const handleProfileEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowProfileMenu(true);
  };

  const handleProfileLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setShowProfileMenu(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  useEffect(() => {
    if (
      hideTools &&
      !['/completed-questionnaires', '/registry'].includes(pathname)
    )
      router.replace('/completed-questionnaires');
  }, [hideTools, pathname, router]);
  if (isClinicLoading)
    return (
      <p role="status" className="p-16">
        Загрузка клиники…
      </p>
    );
  if (
    hideTools &&
    !['/completed-questionnaires', '/registry'].includes(pathname)
  )
    return (
      <p role="status" className="p-16">
        Открытие анкет…
      </p>
    );
  return (
    <>
      {!hideHeader && (
        <header className="header bg-white relative">
          <div className="header__container flex items-center justify-between px-6 py-4">
            <Image
              alt="logo"
              className="logo cursor-pointer"
              src="/logo.svg"
              width={206}
              height={26}
            />
            {/* Абсолютно по центру шапки, а не третьим флекс-элементом: при
                justify-between он встал бы между блоками разной ширины, а не
                по центру страницы. Шапка — position: fixed на всю ширину
                (.header в globals.css вне @layer перебивает утилиту relative),
                поэтому центровка идёт по всей странице. */}
            <div className="absolute top-1/2 left-[250px] right-[320px] -translate-y-1/2 overflow-x-auto whitespace-nowrap">
              <AppNav />
            </div>
            <div className="flex items-center gap-9">
              {!hideTools && (
                <div
                  className="hover:text-[#769CEF] cursor-pointer text-[#5D8CF1]"
                  onClick={() => setShowDoctorsHelpers(true)}
                >
                  Помощники врача
                </div>
              )}
              {!hideTools && (
                <Image
                  onClick={() => setIsDictionaryOpen(true)}
                  alt="settings"
                  className="cursor-pointer icon"
                  src="/setting-fill.svg"
                  width={23}
                  height={23}
                />
              )}
              <div
                className="relative"
                onMouseEnter={handleProfileEnter}
                onMouseLeave={handleProfileLeave}
              >
                <Image
                  alt="profile"
                  className="profile cursor-pointer icon"
                  src="/profile.svg"
                  width={23}
                  height={23}
                />

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-65 bg-white rounded-xl shadow-custom p-5 z-50">
                    {user && (
                      <div className=" pb-6.25">
                        <p className="text-[#202020] text-base truncate">
                          {user.login}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full cursor-pointer py-2.5 px-4 bg-[#FED7D7] hover:bg-[#FECACA] text-[#E53E3E] rounded-lg font-medium transition-colors text-sm"
                    >
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <SettingsPopup
        isOpen={isDictionaryOpen}
        onClose={() => setIsDictionaryOpen(false)}
      />

      <main className="flex bg-[#F3F4F8] min-h-screen w-full mx-auto my-20">
        {children}
      </main>

      <DoctorsHelpers
        isOpen={showDoctorsHelpers}
        onClose={() => setShowDoctorsHelpers(false)}
      />
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicAccessGate>
      <WorkingLayout>{children}</WorkingLayout>
    </ClinicAccessGate>
  );
}
