'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { ProtocolStructuresSection } from './ProtocolStructuresSection';
import { DirectoriesSection } from './DirectoriesSection';

interface User {
  id: string;
  email: string;
  role: string;
}

type SettingsSection = 'users' | 'protocols' | 'directories';

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPopup: React.FC<SettingsPopupProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('users');
  const [users, setUsers] = useState<User[]>([
    { id: '1', email: 'test@gmail.com', role: 'admin' },
    { id: '2', email: 'test1@gmail.com', role: 'department_head' },
    { id: '3', email: 'test2@gmail.com', role: 'doctor' },
    { id: '10', email: 'test@gmail.com', role: 'admin' },
    { id: '20', email: 'test1@gmail.com', role: 'department_head' },
    { id: '30', email: 'test2@gmail.com', role: 'doctor' },
    { id: '11', email: 'test@gmail.com', role: 'admin' },
    { id: '12', email: 'test1@gmail.com', role: 'department_head' },
    { id: '13', email: 'test2@gmail.com', role: 'doctor' },
    { id: '21', email: 'test@gmail.com', role: 'admin' },
    { id: '22', email: 'test1@gmail.com', role: 'department_head' },
    { id: '23', email: 'test2@gmail.com', role: 'doctor' },
    { id: '31', email: 'test@gmail.com', role: 'admin' },
    { id: '32', email: 'test1@gmail.com', role: 'department_head' },
    { id: '33', email: 'test2@gmail.com', role: 'doctor' },
  ]);

  const roleOptions: DropdownOption<string>[] = [
    { value: 'admin', label: 'Админ' },
    { value: 'department_head', label: 'Зав.отделением' },
    { value: 'doctor', label: 'Врач' },
  ];

  const menuItems: { id: SettingsSection; label: string }[] = [
    { id: 'users', label: 'Пользователи' },
    { id: 'protocols', label: 'Структуры протоколов' },
    { id: 'directories', label: 'Справочники' },
  ];

  const getRoleLabel = (value: string) => {
    return roleOptions.find((opt) => opt.value === value)?.label || value;
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user,
      ),
    );
    toast.success('Роль пользователя обновлена');
  };

  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(
    null,
  );

  const handleDeleteUser = (userId: string) => {
    setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    setDeleteConfirmUserId(null);
    toast.success('Пользователь удален');
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
    setActiveSection(section);
  };

  if (!isOpen) return null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'users':
        return (
          <div className="py-5.25 pl-14 h-full pr-8 flex flex-col gap-9">
            <div className="h-full">
              <div className="flex flex-col gap-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`flex justify-between items-center px-3.75 py-3 rounded-xl cursor-pointer transition-all shadow-custom-hover`}
                  >
                    <span className="text-sm text-[#202020]">{user.email}</span>

                    <div className="flex flex-row items-center gap-12.5">
                      <div className="w-41.25">
                        <CustomDropdown
                          options={roleOptions}
                          value={user.role}
                          onChange={(newRole) =>
                            handleRoleChange(user.id, newRole)
                          }
                          showCheckIcon={false}
                          className="w-48"
                        />
                      </div>

                      <button
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
                    </div>
                  </div>
                ))}
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

  const getSectionTitle = () => {
    const titles: Record<SettingsSection, string> = {
      users: 'Пользователи',
      protocols: 'Структуры протоколов',
      directories: 'Справочники',
    };
    return titles[activeSection];
  };

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
