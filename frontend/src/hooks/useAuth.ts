import { useAuthStore } from '@/store/authStore';
import { mainApi } from '@/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

export const useAuth = () => {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, login, logout } = useAuthStore();

  const handleLogin = async (credentials: {
    login: string;
    password: string;
  }) => {
    try {
      const response = await mainApi.serviceUsers.login(credentials);

      login(response.user, response.access_token);
      localStorage.setItem('access_token', response.access_token);
      router.push('/');

      return { success: true };
    } catch (error) {
      toast.error('Ошибка входа: ' + error);
      console.log(error);
      return { success: false, error };
    }
  };

  const handleRegister = async (credentials: {
    login: string;
    password: string;
  }) => {
    try {
      await mainApi.serviceUsers.register(credentials);
      toast.info('Код подтверждения отправлен на почту');
      return { success: true };
    } catch (error) {
      toast.error('Ошибка регистрации: ' + error);
      console.log(error);
      return { success: false, error };
    }
  };
  const handleConfirmRegistration = async (userLogin: string, code: string) => {
    try {
      const response = await mainApi.serviceUsers.confirm({
        login: userLogin,
        code,
      });

      login(response.user, response.access_token);
      localStorage.setItem('access_token', response.access_token);
      router.push('/');

      return { success: true };
    } catch (error) {
      toast.error('Неверный код подтверждения: ' + error);
      console.log(error);
      return { success: false, error };
    }
  };

  const handleLogout = async () => {
    try {
      await mainApi.serviceUsers.logout();
      logout();
      localStorage.removeItem('access_token');
      router.push('/login');

      return { success: true };
    } catch (error) {
      toast.error('Не удалось выйти из профиля: ' + error);
      console.log(error);
      return { success: false, error };
    }
  };

  const checkAuth = () => {
    return isAuthenticated && !!accessToken && !!user;
  };

  const getAuthHeader = () => {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  };

  return {
    user,
    accessToken,
    isAuthenticated,
    handleLogin,
    handleRegister,
    handleConfirmRegistration,
    handleLogout,
    checkAuth,
    getAuthHeader,
  };
};
