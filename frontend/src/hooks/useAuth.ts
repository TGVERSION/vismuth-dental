import { useAuthStore } from '@/store/authStore';
import { mainApi, type InvitationAcceptRequest } from '@/api';
import { ApiError } from '@/api/base-client';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useHelpersStore } from '@/store/helpersStore';

export type AcceptInvitationResult =
  | { success: true }
  | { success: false; accepted: boolean; status?: number };

export const useAuth = () => {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, login, logout, setAccessToken } =
    useAuthStore();
  const { fetchUserSettings } = useHelpersStore();

  const handleLogin = async (credentials: {
    login: string;
    password: string;
  }) => {
    try {
      const response = await mainApi.serviceUsers.login(credentials);

      // Токен кладём в стор до запроса профиля — интерцептор берёт его оттуда.
      setAccessToken(response.access_token);
      const user = await mainApi.serviceUsers.serviceUser();
      const saveUser = {
        ...user,
        id: response.user.id,
      };
      login(saveUser, response.access_token);

      const userId = response.user.id;
      if (userId) fetchUserSettings(userId).catch(() => {});
      router.push('/');

      return { success: true };
    } catch (error) {
      toast.error('Ошибка входа: ' + error);
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
      return { success: false, error };
    }
  };
  const handleConfirmRegistration = async (userLogin: string, code: string) => {
    try {
      const response = await mainApi.serviceUsers.confirm({
        login: userLogin,
        code,
      });

      setAccessToken(response.access_token);
      const user = await mainApi.serviceUsers.serviceUser();
      const saveUser = {
        ...user,
        id: response.user.id,
      };
      login(saveUser, response.access_token);
      router.push('/');

      return { success: true };
    } catch (error) {
      toast.error('Неверный код подтверждения: ' + error);
      return { success: false, error };
    }
  };

  /**
   * Принять приглашение в клинику и войти. Ошибку не показывает сама —
   * странице нужны разные тексты для 404, 410 и 409, поэтому возвращается
   * статус. Порядок входа — как после подтверждения регистрации.
   */
  const handleAcceptInvitation = async (
    data: InvitationAcceptRequest,
  ): Promise<AcceptInvitationResult> => {
    let accepted = false;
    try {
      const response = await mainApi.invitations.accept(data);
      accepted = true;

      setAccessToken(response.access_token);
      const me = await mainApi.serviceUsers.serviceUser();
      login({ ...me, id: response.user.id }, response.access_token);

      fetchUserSettings(response.user.id).catch(() => {});
      // replace: токен приглашения не должен остаться в истории браузера.
      router.replace('/');

      return { success: true };
    } catch (error) {
      // Приглашение уже использовано, но профиль не загрузился. Сбрасываем
      // авторизацию целиком: иначе при открытой сессии другого пользователя
      // в сторе остался бы его профиль без токена. Войдёт обычным способом.
      if (accepted) logout();
      return {
        success: false,
        accepted,
        status: error instanceof ApiError ? error.status : undefined,
      };
    }
  };

  const handleLogout = async () => {
    try {
      await mainApi.serviceUsers.logout();
      logout();
      router.push('/login');

      return { success: true };
    } catch (error) {
      toast.error('Не удалось выйти из профиля: ' + error);
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
    handleAcceptInvitation,
    handleLogout,
    checkAuth,
    getAuthHeader,
  };
};
