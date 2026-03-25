'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user, handleLogout } = useAuth();
  const hideHeader = ['/login', '/register'].includes(pathname);

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

            <div
              className="relative"
              onMouseEnter={handleProfileEnter}
              onMouseLeave={handleProfileLeave}
            >
              <Image
                alt="profile"
                className="profile cursor-pointer"
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
                    onClick={handleLogout}
                    className="w-full cursor-pointer py-2.5 px-4 bg-[#FED7D7] hover:bg-[#FECACA] text-[#E53E3E] rounded-lg font-medium transition-colors text-sm"
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex bg-[#F3F4F8] min-h-screen w-full gap-5 mx-auto my-20">
        {children}
      </main>
    </>
  );
}
