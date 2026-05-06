'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import Example from '../Example';
import ExampleCheckbox from '../ExampleCheckbox';
import MultipleDropdownExample from '../MultipleDropdownExample';

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

  const handleDeleteUser = (userId: string) => {
    setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    toast.success('Пользователь удален');
  };

  const closeModal = () => {
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
            <div className="overflow-x-auto h-full">
              <table className="w-full h-full">
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="group">
                      <td className="py-4 pr-4">
                        <span className="text-sm text-[#202020]">
                          {user.email}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <CustomDropdown
                          options={roleOptions}
                          value={user.role}
                          onChange={(newRole) =>
                            handleRoleChange(user.id, newRole)
                          }
                          showCheckIcon={false}
                          className="w-48"
                        />
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Example />
            <ExampleCheckbox />
            <MultipleDropdownExample />
          </div>
        );

      case 'protocols':
        return (
          <div className="py-5.25 pl-14 h-full pr-8 flex flex-col gap-9">
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p className="text-lg">
                Раздел «Структуры протоколов» в разработке
              </p>
            </div>
          </div>
        );

      case 'directories':
        return (
          <div className="py-5.25 pl-14 h-full pr-8 flex flex-col gap-9">
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p className="text-lg">Раздел «Справочники» в разработке</p>
            </div>
          </div>
        );

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
                          : 'hover:bg-white hover:shadow-custom-hover'
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
                <div className="flex items-center justify-between pb-6 border-b px-8 border-gray-200">
                  <div className="flex items-center gap-3">
                    <h3 className="text-3xl font-medium text-[#202020]">
                      {getSectionTitle()}
                    </h3>
                  </div>
                </div>

                {renderSectionContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
