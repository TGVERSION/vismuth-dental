'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { ProtocolStructuresSection } from './ProtocolStructuresSection';
import { DirectoriesSection } from './DirectoriesSection';
import { mainApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { isPrivilegedRole, isSuperAdmin } from '@/lib/roles';
import {
  getSettingsSectionLabel,
  getSettingsSections,
  resolveSettingsSection,
  type SettingsAccess,
  type SettingsSection,
} from '@/lib/settings-sections';
import { ClinicsSection } from './clinics/ClinicsSection';
import { UserSettingsCard, type SettingsUser } from './UserSettingsCard';
import {
  userMembershipApi,
  type MembershipRoleOption,
} from '@/api/user-membership-api';

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPopup: React.FC<SettingsPopupProps> = ({
  isOpen,
  onClose,
}) => {
  // null — раздел ещё не выбран: какой открыть, решает роль.
  const [selectedSection, setSelectedSection] =
    useState<SettingsSection | null>(null);
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [membershipRoles, setMembershipRoles] = useState<
    MembershipRoleOption[]
  >([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(
    null,
  );

  const currentUser = useAuthStore((state) => state.user);
  const access: SettingsAccess = {
    canManageClinics: isSuperAdmin(currentUser?.role),
    canManageUsers: isPrivilegedRole(currentUser?.role),
  };
  // Окно смонтировано в layout заранее, а роль освежается с сервера уже
  // после монтирования, поэтому раздел вычисляется при каждом рендере.
  const activeSection = resolveSettingsSection(selectedSection, access);
  const menuItems = getSettingsSections(access);
  // Повторный клик по «Клиникам» возвращает раздел к списку клиник.
  const [clinicsResetKey, setClinicsResetKey] = useState(0);

  useEffect(() => {
    if (!isOpen || activeSection !== 'users') return;

    let cancelled = false;

    const load = async () => {
      setUsersLoading(true);
      const [usersResult, membershipRolesResult] = await Promise.allSettled([
        isSuperAdmin(currentUser?.role)
          ? userMembershipApi.list()
          : mainApi.serviceUsers.listServiceUserIds(),
        userMembershipApi.staffRoles(),
      ]);
      if (cancelled) return;

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        toast.error('Не удалось загрузить пользователей');
      }
      if (membershipRolesResult.status === 'fulfilled')
        setMembershipRoles(membershipRolesResult.value);
      else {
        setMembershipRoles([]);
        toast.error('Не удалось загрузить роли клиники');
      }

      setUsersLoading(false);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeSection, currentUser?.role]);

  const handleDeleteUser = async (userId: string) => {
    setPendingUserId(userId);
    try {
      await mainApi.serviceUsers.deleteServiceUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeleteConfirmUserId(null);
      toast.success('Пользователь удален');
    } catch {
      toast.error('Не удалось удалить пользователя');
    } finally {
      setPendingUserId(null);
    }
  };

  const protocolCloseRef = useRef<(() => void) | null>(null);

  const closeModal = () => {
    if (activeSection === 'protocols' && protocolCloseRef.current) {
      protocolCloseRef.current();
      return;
    }
    onClose();
  };

  const handleSectionChange = (section: SettingsSection) => {
    if (section === 'clinics' && activeSection === 'clinics') {
      setClinicsResetKey((key) => key + 1);
    }
    setSelectedSection(section);
  };

  if (!isOpen) return null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'clinics':
        return <ClinicsSection resetKey={clinicsResetKey} />;

      case 'users':
        return (
          <div className="min-w-0 bg-[var(--ui-color-alabaster-100)] p-4 sm:p-6">
            {usersLoading ? (
              <div
                role="status"
                aria-label="Загрузка пользователей"
                className="mx-auto my-20 h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--ui-color-blue-600)]"
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-3">
                {users.map((user) => (
                  <UserSettingsCard
                    key={user.id}
                    user={user}
                    actorId={currentUser?.id}
                    actorRole={currentUser?.role}
                    membershipRoles={membershipRoles}
                    pending={pendingUserId !== null}
                    canManageClinics={access.canManageClinics}
                    onMembershipSaved={(updated) => {
                      setUsers((previous) =>
                        previous.map((item) =>
                          item.id === updated.id
                            ? { ...item, ...updated }
                            : item,
                        ),
                      );
                      toast.success('Клиника и доступ пользователя обновлены');
                    }}
                    onDelete={setDeleteConfirmUserId}
                  />
                ))}
                {!users.length && (
                  <p className="py-10 text-center text-sm text-[var(--ui-color-alabaster-950)]">
                    Пользователи не найдены
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'protocols':
        return (
          <ProtocolStructuresSection
            onPopupClose={onClose}
            externalCloseRef={protocolCloseRef}
          />
        );

      case 'directories':
        return <DirectoriesSection />;

      default:
        return null;
    }
  };

  const getSectionTitle = () => getSettingsSectionLabel(activeSection);

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-4 sm:px-5 sm:py-10"
        // Модалки поверх настроек блокируют эту прокрутку (ModalShell).
        data-modal-scroll-lock
        onClick={closeModal}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-2xl min-h-[calc(100vh-80px)] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 flex-1 flex-col md:flex-row">
            <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--ui-color-slate-200)] p-4 sm:p-6 md:w-60 md:border-r md:border-b-0 md:p-6">
              <h2 className="text-2xl font-semibold text-[var(--ui-color-alabaster-dark-800)] md:text-[length:var(--ui-font-size-34)]">
                Настройки
              </h2>
              <div className="overflow-x-auto md:overflow-visible">
                <div className="flex min-w-max gap-1 md:min-w-0 md:flex-col md:gap-1">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className={`px-[var(--ui-space-14)] py-3 rounded-lg cursor-pointer transition-all ${
                        activeSection === item.id
                          ? 'bg-white shadow-custom'
                          : 'hover:bg-white shadow-custom-hover'
                      }`}
                      onClick={() => handleSectionChange(item.id)}
                    >
                      <div className="flex items-center gap-[var(--ui-space-14)]">
                        <div className="flex flex-col gap-1">
                          <span className="text-md text-[var(--ui-color-alabaster-dark-800)]">
                            {item.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-[var(--ui-space-10)] mr-[var(--ui-space-10)] cursor-pointer transition-colors"
                >
                  <Image alt="close" src="/close.svg" width={25} height={25} />
                </button>
              </div>

              <div>
                {activeSection === 'users' && (
                  <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-5 sm:px-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-3xl font-medium text-[var(--ui-color-alabaster-dark-800)]">
                        {getSectionTitle()}
                      </h3>
                    </div>
                  </div>
                )}

                {renderSectionContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {deleteConfirmUserId && (
        <div
          className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteConfirmUserId(null)}
        >
          <div
            className="bg-white rounded-[var(--ui-radius-2xl)] px-10 py-10 w-141.25 shadow-2xl flex flex-col animate-fade-in relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDeleteConfirmUserId(null)}
              className="absolute top-5 right-5 cursor-pointer"
            >
              <Image alt="close" src="/close.svg" width={25} height={25} />
            </button>

            <div className="flex flex-col text-center">
              <p className="text-[length:var(--ui-font-size-34)] font-medium text-center mb-5">
                Вы действительно хотите удалить пользователя?
              </p>
              <p className="mb-[var(--ui-space-32)]  text-[length:var(--ui-font-size-18)] text-center text-[var(--ui-color-alabaster-950)]">
                Для входа этому пользователю придётся зарегистрироваться заново
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteConfirmUserId)}
                className="w-full h-12 bg-[var(--ui-color-red-400)] hover:bg-[var(--ui-color-red-400)] text-white rounded-2xl text-base transition-colors cursor-pointer"
              >
                Удалить
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmUserId(null)}
                className="w-full h-12 bg-[var(--ui-color-blue-100)] hover:bg-[var(--ui-color-blue-200)] text-[var(--ui-color-alabaster-dark-800)] rounded-2xl text-base transition-colors cursor-pointer"
              >
                Оставить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
