'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CustomDropdown } from '../CustomDropdown';
import { ProtocolStructuresSection } from './ProtocolStructuresSection';
import { DirectoriesSection } from './DirectoriesSection';
import { mainApi } from '@/api';
import type { RoleRead, ServiceUserIdRead } from '@/api';
import { useAuthStore } from '@/store/authStore';
import {
  buildRoleOptions,
  canDeleteUser,
  canEditUserRole,
  isPrivilegedRole,
} from '@/lib/roles';
import {
  getSettingsSectionLabel,
  getSettingsSections,
  resolveSettingsSection,
  type SettingsSection,
} from '@/lib/settings-sections';

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
  const [users, setUsers] = useState<ServiceUserIdRead[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roles, setRoles] = useState<RoleRead[]>([]);
  const [rolesFailed, setRolesFailed] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(
    null,
  );

  const currentUser = useAuthStore((state) => state.user);
  const canManageUsers = isPrivilegedRole(currentUser?.role);
  // Окно смонтировано в layout заранее, а роль освежается с сервера уже
  // после монтирования, поэтому раздел вычисляется при каждом рендере.
  const activeSection = resolveSettingsSection(selectedSection, canManageUsers);
  const menuItems = getSettingsSections(canManageUsers);

  useEffect(() => {
    if (!isOpen || activeSection !== 'users') return;

    let cancelled = false;

    const load = async () => {
      setUsersLoading(true);
      const [usersResult, rolesResult] = await Promise.allSettled([
        mainApi.serviceUsers.listServiceUserIds(),
        mainApi.roles.list(),
      ]);
      if (cancelled) return;

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        toast.error('Не удалось загрузить пользователей');
      }

      // Без справочника список пользователей всё равно показываем:
      // роли подписаны из role_name_ru, но сменить их нельзя.
      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value);
        setRolesFailed(false);
      } else {
        setRoles([]);
        setRolesFailed(true);
        toast.error('Не удалось загрузить список ролей');
      }

      setUsersLoading(false);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeSection]);

  const handleRoleChange = async (userId: string, value: string) => {
    if (pendingUserId) return;

    // Код роли берём из справочника: в список может попасть запасная опция
    // с устаревшим кодом, отправлять её на сервер нельзя.
    const role = roles.find((item) => item.name === value);
    const target = users.find((item) => item.id === userId);
    if (!role || !target || target.role === role.name) return;

    setPendingUserId(userId);
    try {
      const updated = await mainApi.serviceUsers.patchServiceUser(userId, {
        role: role.name,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, role: updated.role, role_name_ru: updated.role_name_ru }
            : u,
        ),
      );
      toast.success('Роль пользователя обновлена');
    } catch {
      toast.error('Не удалось обновить роль');
    } finally {
      setPendingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await mainApi.serviceUsers.deleteServiceUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeleteConfirmUserId(null);
      toast.success('Пользователь удален');
    } catch {
      toast.error('Не удалось удалить пользователя');
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
    setSelectedSection(section);
  };

  if (!isOpen) return null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'users':
        return (
          <div className="py-5.25 pl-14 h-full pr-8 flex flex-col gap-9">
            <div className="h-full">
              <div className="flex flex-col gap-2">
                {usersLoading ? (
                  <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
                ) : (
                  <>
                    {users.map((user) => {
                      const actionParams = {
                        actorId: currentUser?.id,
                        actorRole: currentUser?.role,
                        targetId: user.id,
                      };
                      const canEdit = canEditUserRole(actionParams);

                      return (
                        <div
                          key={user.id}
                          className={`flex justify-between items-center px-3.75 py-3 rounded-xl cursor-pointer transition-all shadow-custom-hover`}
                        >
                          <span className="text-sm text-[#202020]">
                            {user.login}
                          </span>

                          <div className="flex flex-row items-center gap-12.5">
                            <div className="w-41.25">
                              <CustomDropdown
                                options={buildRoleOptions(roles, user)}
                                value={user.role}
                                onChange={(value) =>
                                  handleRoleChange(user.id, value)
                                }
                                disabled={
                                  !canEdit ||
                                  rolesFailed ||
                                  pendingUserId === user.id
                                }
                                aria-label={`Роль пользователя ${user.login}`}
                                showCheckIcon={false}
                                className="w-48"
                              />
                            </div>

                            {canDeleteUser(actionParams) ? (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmUserId(user.id)}
                                className="cursor-pointer"
                                aria-label="Удалить пользователя"
                              >
                                <Image
                                  src="/delete-gray.svg"
                                  alt="delete"
                                  width={18}
                                  height={18}
                                  className="icon-gray"
                                />
                              </button>
                            ) : (
                              // Держит место кнопки, чтобы строки не съезжали.
                              <span aria-hidden="true" className="w-4.5" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
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
        className="modal-overlay fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={closeModal}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-2xl min-h-[calc(100vh-80px)] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1">
            <div className="border-r border-[#E9ECEF] p-8 flex gap-4 flex-col max-w-102.25">
              <h2 className="text-[34px] font-semibold text-[#202020]">
                Настройки
              </h2>
              <div className="space-y-4.5">
                <div>
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3.75 py-3 rounded-lg cursor-pointer transition-all ${
                        activeSection === item.id
                          ? 'bg-white shadow-custom'
                          : 'hover:bg-white shadow-custom-hover'
                      }`}
                      onClick={() => handleSectionChange(item.id)}
                    >
                      <div className="flex items-center gap-3.75">
                        <div className="flex flex-col gap-1">
                          <span className="text-md text-[#202020]">
                            {item.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-2.5 mr-2.5 cursor-pointer transition-colors"
                >
                  <Image alt="close" src="/close.svg" width={25} height={25} />
                </button>
              </div>

              <div>
                {activeSection !== 'protocols' &&
                  activeSection !== 'directories' && (
                    <div className="flex items-center justify-between pb-6 border-b px-8 border-gray-200">
                      <div className="flex items-center gap-3">
                        <h3 className="text-3xl font-medium text-[#202020]">
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
            className="bg-white rounded-[15px] px-10 py-10 w-141.25 shadow-2xl flex flex-col animate-fade-in relative"
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
              <p className="text-[34px] font-medium text-center mb-5">
                Вы действительно хотите удалить пользователя?
              </p>
              <p className="mb-7.5  text-[18px] text-center text-[#6C757D]">
                Для входа этому пользователю придётся зарегистрироваться заново
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteConfirmUserId)}
                className="w-full h-12 bg-[#F15D5D] hover:bg-[#F26E6E] text-white rounded-2xl text-base transition-colors cursor-pointer"
              >
                Удалить
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmUserId(null)}
                className="w-full h-12 bg-[#E8EEFF] hover:bg-[#D6E0FF] text-[#202020] rounded-2xl text-base transition-colors cursor-pointer"
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
