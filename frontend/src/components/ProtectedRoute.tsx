'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoaded } = useAuthStore();

  useEffect(() => {
    if (!isLoaded) return;

    const isAuthPage = ['/login', '/register', '/verify'].includes(pathname);

    if (!isAuthPage && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoaded, isAuthenticated, pathname, router]);

  const isAuthPage = ['/login', '/register', '/verify'].includes(pathname);
  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5D8CF1] mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
