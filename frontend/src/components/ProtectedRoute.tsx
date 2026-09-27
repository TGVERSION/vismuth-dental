'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// Маршруты, доступные без авторизации. Новый публичный маршрут нужно
// добавлять сюда одновременно с созданием страницы в src/app/(public).
export const PUBLIC_ROUTES = ['/login', '/register', '/verify'];

const isPublicRoute = (pathname: string) => PUBLIC_ROUTES.includes(pathname);

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const FullScreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5D8CF1] mx-auto mb-4"></div>
    </div>
  </div>
);

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoaded } = useAuthStore();

  const isAuthPage = isPublicRoute(pathname);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isAuthPage && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoaded, isAuthenticated, isAuthPage, router]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Пока состояние авторизации не восстановлено из хранилища и пока идёт
  // редирект неавторизованного пользователя, защищённое содержимое не
  // монтируем: иначе экран протокола успевает отрисоваться и отправить
  // запросы, которые всё равно вернут 401.
  if (!isLoaded || !isAuthenticated) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
