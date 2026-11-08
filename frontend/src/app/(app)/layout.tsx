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
import { nonClinicalStaff } from '@/lib/clinic-access';
import { AppNav } from '@/components/AppNav';
import { OwnClinicSettings } from '@/components/settings/clinics/OwnClinicSettings';

function WorkingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { clinic, isLoading: isClinicLoading } = useMyClinic();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [showClinicSettings, setShowClinicSettings] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user, handleLogout } = useAuth();
  const hideTools =
    user?.role !== 'super_admin' &&
    (isClinicLoading || nonClinicalStaff(clinic));
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
      !isClinicLoading &&
      hideTools &&
      !['/completed-questionnaires', '/registry'].includes(pathname)
    )
      router.replace('/completed-questionnaires');
  }, [hideTools, isClinicLoading, pathname, router]);
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
          <div className="header__container">
            <Image
              alt="logo"
              className="logo cursor-pointer"
              src="/logo.svg"
              width={206}
              height={26}
            />
            <div className="header__navigation">
              <AppNav />
            </div>
            <div className="header__actions">
              {!hideTools && (
                <button
                  type="button"
                  className="header__helpers hover:text-[var(--ui-color-blue-700)] cursor-pointer text-[var(--ui-color-blue-600)]"
                  onClick={() => setShowDoctorsHelpers(true)}
                >
                  Помощники врача
                </button>
              )}
              {(!hideTools || clinic?.is_clinic_admin) && (
                <button
                  type="button"
                  className="vismuth-icon-button"
                  aria-label="Настройки"
                  onClick={() => {
                    setShowClinicSettings(true);
                    setIsDictionaryOpen(true);
                  }}
                >
                  <Image
                    alt="settings"
                    className="cursor-pointer icon"
                    src="/setting-fill.svg"
                    width={23}
                    height={23}
                  />
                </button>
              )}
              <div
                className="relative"
                onMouseEnter={handleProfileEnter}
                onMouseLeave={handleProfileLeave}
              >
                <button
                  type="button"
                  className="vismuth-icon-button"
                  aria-label="Профиль"
                  aria-expanded={showProfileMenu}
                  onClick={() => setShowProfileMenu((value) => !value)}
                >
                  <Image
                    alt="profile"
                    className="profile cursor-pointer icon"
                    src="/profile.svg"
                    width={23}
                    height={23}
                  />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-65 bg-white rounded-xl shadow-custom p-5 z-50">
                    {user && (
                      <div className=" pb-[var(--ui-space-24)]">
                        <p className="text-[var(--ui-color-alabaster-dark-800)] text-base truncate">
                          {user.login}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="vismuth-button--danger w-full cursor-pointer py-[var(--ui-space-10)] px-4 bg-[var(--ui-color-red-100)] hover:bg-[var(--ui-color-red-200)] text-[var(--ui-color-red-600)] rounded-lg font-medium transition-colors text-sm"
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
        isOpen={
          isDictionaryOpen &&
          !(
            user?.role !== 'super_admin' &&
            clinic?.is_clinic_admin &&
            showClinicSettings
          )
        }
        onClose={() => setIsDictionaryOpen(false)}
      />
      {isDictionaryOpen &&
        user?.role !== 'super_admin' &&
        clinic?.is_clinic_admin &&
        showClinicSettings && (
          <OwnClinicSettings
            clinic={clinic}
            onClose={() => setIsDictionaryOpen(false)}
            onClinicalSettings={
              clinic.is_doctor ? () => setShowClinicSettings(false) : undefined
            }
          />
        )}

      <main className="app-main flex bg-[var(--ui-color-slate-100)] min-h-screen w-full mx-auto my-20">
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
