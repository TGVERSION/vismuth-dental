'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshCurrentUser } from '@/hooks/useRefreshCurrentUser';
import { DoctorsHelpers } from '@/components/DoctorsHelpers';
import { SettingsPopup } from '@/components/settings/SettingsPopup';
import { AppNav } from '@/components/AppNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <AppNav />
            </div>
            <div className="flex items-center gap-9">
              <div
                className="hover:text-[#769CEF] cursor-pointer text-[#5D8CF1]"
                onClick={() => setShowDoctorsHelpers(true)}
              >
                Помощники врача
              </div>
              <Image
                onClick={() => setIsDictionaryOpen(true)}
                alt="settings"
                className="cursor-pointer icon"
                src="/setting-fill.svg"
                width={23}
                height={23}
              />
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
